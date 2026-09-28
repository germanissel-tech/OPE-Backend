// Catalogue store on the durable store (ADR-025): the current snapshot of a merchant and the
// instants OPE received the last few, which the observed synchronisation level is derived from.
//
// Losing this is not losing evidence — the platform can publish again — but it does stop the shop:
// with no catalogue OPE has no truth of product, so it intervenes nowhere until the next
// publication, which in a daily flow can be a day, and nothing says so.
//
// **How many receipts are kept is the merchant's policy and arrives with every write**, so it is
// not a column, not a constant and not a decision of this file (constitution XI).
import { CatalogSnapshot, type CatalogSnapshotRecord } from "../../../domain/catalog/index.js";
import { attempted, type DurableGatewayDeps } from "../../ledger/index.js";
import { fromDocument, toDocument } from "../../shared-kernel/index.js";
import type { CatalogStore } from "../../../application/catalog/index.js";

const DOCUMENT = "document";
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

/** Oldest first, which is the order the port promises. */
const RECEIPTS = `SELECT received_at FROM catalog_receipts WHERE merchant_id = :merchant ORDER BY id`;

export function sqliteCatalogStore(deps: DurableGatewayDeps): CatalogStore {
  return {
    current: (merchantId) => {
      const rows = deps.store.all(CURRENT, { merchant: merchantId });
      return Promise.resolve(
        rows.length === 0
          ? undefined
          : CatalogSnapshot.rehydrate(fromDocument(String(rows[0]?.[DOCUMENT])) as CatalogSnapshotRecord),
      );
    },

    replace: (merchantId, snapshot, receiptsKept) =>
      attempted(deps, "catalog", () => {
        // One transaction: a snapshot whose receipt was not recorded would report a
        // synchronisation level that does not match what was actually published.
        deps.store.transaction(() => {
          deps.store.run(REPLACE, { merchant: merchantId, document: toDocument(snapshot.record()) });
          deps.store.run(ADD_RECEIPT, {
            merchant: merchantId,
            receivedAt: snapshot.receivedAt.toISOString(),
          });
          deps.store.run(PRUNE_RECEIPTS, { merchant: merchantId, kept: receiptsKept });
        });
      }),

    receipts: (merchantId) =>
      Promise.resolve(
        deps.store.all(RECEIPTS, { merchant: merchantId }).map((row) => new Date(String(row[RECEIVED_AT]))),
      ),
  };
}
