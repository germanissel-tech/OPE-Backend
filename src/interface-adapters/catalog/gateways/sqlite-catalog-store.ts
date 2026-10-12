// Catalogue store on the durable store (ADR-025, ADR-047): the current snapshot of a merchant, the refreshes
// of stock and price layered over it, and the instants OPE received the last few of either, which the
// observed synchronisation level is derived from.
//
// Losing this is not losing evidence — the platform can publish again — but it does stop the shop:
// with no catalogue OPE has no truth of product, so it intervenes nowhere until the next
// publication, which in a daily flow can be a day, and nothing says so.
//
// **How many receipts are kept is the merchant's policy and arrives with every write**, so it is
// not a column, not a constant and not a decision of this file (constitution XI).
import {
  CatalogSnapshot,
  StockAndPrice,
  type CatalogSnapshotRecord,
  type StockAndPriceRecord,
} from "../../../domain/catalog/index.js";
import { attempted, type DurableGatewayDeps } from "../../ledger/index.js";
import { fetched, fromDocument, toDocument, type SqlStore } from "../../shared-kernel/index.js";
import type { CatalogStore } from "../../../application/catalog/index.js";
import type { MerchantId } from "../../../domain/shared-kernel/index.js";

const DOCUMENT = "document";
/** What a failed write of this store says it was writing. */
const WRITE = "catalog";
const RECEIVED_AT = "received_at";

const CURRENT = `SELECT document FROM catalog_snapshots WHERE merchant_id = :merchant`;

/**
 * One row per merchant, replaced whole: a publication supersedes the previous snapshot. The
 * conflict branch sets `updated_at` itself, because the column's DEFAULT only fires on the insert
 * — so a republished snapshot keeps the `created_at` of the first one and moves only `updated_at`,
 * which is what the two columns are for.
 */
const REPLACE = `INSERT INTO catalog_snapshots (merchant_id, document) VALUES (:merchant, :document)
  ON CONFLICT (merchant_id) DO UPDATE
  SET document = excluded.document, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;

const ADD_RECEIPT = `INSERT INTO catalog_receipts (merchant_id, received_at) VALUES (:merchant, :receivedAt)`;

/**
 * Keeps the last `:kept` receipts of the merchant and deletes the rest. `id` is the order of
 * arrival, so "the last few" needs no instant comparison — two publications of the same instant
 * (a replay) stay in the order they were received.
 *
 * It used to say `rowid`, SQLite's implicit column, which **PostgreSQL does not have**: one of the
 * three things debt D-21 left resting on this engine. The migration 002 gave every table its own
 * autoincrementing `id`, so the order is now a column the schema declares (feature 031, FR-014).
 */
const PRUNE_RECEIPTS = `DELETE FROM catalog_receipts WHERE merchant_id = :merchant AND id NOT IN (
    SELECT id FROM catalog_receipts WHERE merchant_id = :merchant ORDER BY id DESC LIMIT :kept
  )`;

/**
 * A snapshot supersedes every refresh observed at its capture or before: the truth of those variants is the
 * snapshot's again, and the table would otherwise only grow (research R-04).
 */
const FORGET_SUPERSEDED = `DELETE FROM stock_and_price WHERE merchant_id = :merchant AND observed_at <= :capturedAt`;

const REFRESH_OF = `SELECT document FROM stock_and_price WHERE merchant_id = :merchant AND variant_id = :variant`;

/**
 * The refresh is replaced whole: only an applied one is written, and a datum is applied only when it is newer
 * than the one kept, so the row never moves backwards. The conflict branch sets `updated_at` as the snapshot's
 * does.
 */
const KEEP_REFRESH = `INSERT INTO stock_and_price (merchant_id, variant_id, observed_at, document)
  VALUES (:merchant, :variant, :observedAt, :document)
  ON CONFLICT (merchant_id, variant_id) DO UPDATE
  SET observed_at = excluded.observed_at, document = excluded.document,
      updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;

/** Oldest first, which is the order the port promises. */
const RECEIPTS = `SELECT received_at FROM catalog_receipts WHERE merchant_id = :merchant ORDER BY id`;

/** The snapshot in force, read inside whatever transaction the caller is in. */
function currentOf(store: SqlStore, merchantId: MerchantId): CatalogSnapshot | undefined {
  const rows = store.all(CURRENT, { merchant: merchantId });
  return rows.length === 0
    ? undefined
    : CatalogSnapshot.rehydrate(fromDocument(String(rows[0]?.[DOCUMENT])) as CatalogSnapshotRecord);
}

function refreshOf(store: SqlStore, merchantId: MerchantId, variantId: string): StockAndPrice | undefined {
  const rows = store.all(REFRESH_OF, { merchant: merchantId, variant: variantId });
  return rows.length === 0
    ? undefined
    : StockAndPrice.rehydrate(fromDocument(String(rows[0]?.[DOCUMENT])) as StockAndPriceRecord);
}

/** Records a receipt and keeps only the last `kept`: a snapshot and a refresh are both receipts (research R-05). */
function receive(store: SqlStore, merchantId: MerchantId, receivedAt: Date, kept: number): void {
  store.run(ADD_RECEIPT, { merchant: merchantId, receivedAt: receivedAt.toISOString() });
  store.run(PRUNE_RECEIPTS, { merchant: merchantId, kept });
}

export function sqliteCatalogStore(deps: DurableGatewayDeps): CatalogStore {
  return {
    current: (merchantId) => fetched(deps, () => currentOf(deps.store, merchantId)),

    replace: (merchantId, snapshot, receiptsKept) =>
      attempted(deps, WRITE, () => {
        // One transaction: a snapshot whose receipt was not recorded would report a
        // synchronisation level that does not match what was actually published.
        deps.store.transaction(() => {
          deps.store.run(REPLACE, { merchant: merchantId, document: toDocument(snapshot.record()) });
          deps.store.run(FORGET_SUPERSEDED, {
            merchant: merchantId,
            capturedAt: snapshot.capturedAt.toISOString(),
          });
          receive(deps.store, merchantId, snapshot.receivedAt, receiptsKept);
        });
      }),

    refreshOf: (merchantId, variantId) => fetched(deps, () => refreshOf(deps.store, merchantId, variantId)),

    refresh: (refresh, receiptsKept) =>
      attempted(deps, WRITE, () =>
        // One transaction: the judgement reads the snapshot and the refreshes kept, and what it decides is
        // written before anything else can read them (01 §6).
        deps.store.transaction(() => {
          const merchant = refresh.merchantId;
          const snapshot = currentOf(deps.store, merchant);
          const judged = refresh.judgedAgainst(snapshot, (variantId) =>
            refreshOf(deps.store, merchant, variantId),
          );
          for (const item of judged.applied) {
            deps.store.run(KEEP_REFRESH, {
              merchant,
              variant: item.variantId,
              observedAt: item.observedAt.toISOString(),
              document: toDocument(item.record()),
            });
          }
          if (snapshot !== undefined) receive(deps.store, merchant, refresh.receivedAt, receiptsKept);
          return judged.outcomes;
        }),
      ),

    receipts: (merchantId) =>
      fetched(deps, () =>
        deps.store.all(RECEIPTS, { merchant: merchantId }).map((row) => new Date(String(row[RECEIVED_AT]))),
      ),
  };
}
