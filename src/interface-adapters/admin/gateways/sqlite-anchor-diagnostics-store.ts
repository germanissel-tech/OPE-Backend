// The anchors the SDK could not resolve, on the durable store (feature 033, US3). One row per key, a
// counter the **store** increments, and a cap that arrives with every write.
//
// **`ON CONFLICT … DO UPDATE SET count = count + 1` is the whole point of the table's shape.** Reading the
// count and writing it back is a race, and the count is what an operator reads: an anchor that has been
// failing for a week is a number, and two reports that arrive together must not each read the same value
// and write it. The store settles it in one statement.
//
// **The key includes the configuration version, with `0` for "the SDK did not say".** A report that names
// the version it had loaded is its own row, which is what tells an operator whether the last publication
// fixed the gap. A nullable column would not do: a unique index of SQLite treats NULLs as distinct, so
// every versionless report would insert a row of its own and no count would ever grow.
//
// **The cap is policy and arrives with the write** (constitution XI, ADR-031), and what it bounds is what
// the **table** holds. A gateway that capped what this process wrote would keep one more row per boot,
// which is the kind of leak nobody sees until a panel takes a second to answer.
import {
  fetched,
  fromDocument,
  pageOf,
  stored,
  toDocument,
  type DurableGatewayDeps,
  type SqlRow,
} from "../../shared-kernel/index.js";
import type { AnchorDiagnosticsStore } from "../../../application/admin/index.js";
import type { AnchorDiagnostic } from "../../../domain/admin/index.js";
import type { MerchantId } from "../../../domain/shared-kernel/index.js";

/** The column every table of this schema keeps the record in. */
const DOCUMENT = "document";
/** What a refused write is reported as. */
const WRITE = "anchor diagnostic";
/** What the schema stores for a report that did not name a configuration version; a published one is ≥ 1. */
const NOT_SAID = 0;

const UPSERT = `INSERT INTO anchor_diagnostics
    (merchant_id, anchor, surface, configuration_version, count, document)
  VALUES (:merchant, :anchor, :surface, :version, 1, :document)
  ON CONFLICT (merchant_id, anchor, surface, configuration_version) DO UPDATE
    SET count = count + 1,
        document = :document,
        updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;

/**
 * Most recently reported first, and `id` breaks the tie: two writes can land in the same millisecond,
 * and without a second key the order of a page would depend on how the store happened to store them.
 */
const OF_MERCHANT = `SELECT count, document FROM anchor_diagnostics
  WHERE merchant_id = :merchant ORDER BY updated_at DESC, id DESC`;

/** The cap, applied to the table: what falls outside the most recently reported `kept` goes. */
const BEYOND_THE_CAP = `DELETE FROM anchor_diagnostics
  WHERE merchant_id = :merchant AND id NOT IN (
    SELECT id FROM anchor_diagnostics WHERE merchant_id = :merchant
    ORDER BY updated_at DESC, id DESC LIMIT :kept
  )`;

export interface SqliteAnchorDiagnosticsDeps extends DurableGatewayDeps {
  /** How many the platform keeps per merchant (level 1): policy, so it arrives and is not a constant. */
  readonly kept: () => number;
}

/** The record as the row holds it: the count is the column's, everything else is the document's. */
const diagnosticOf = (row: SqlRow): AnchorDiagnostic => ({
  ...(fromDocument(String(row[DOCUMENT])) as Omit<AnchorDiagnostic, "count">),
  count: Number(row["count"]),
});

export function sqliteAnchorDiagnosticsStore(deps: SqliteAnchorDiagnosticsDeps): AnchorDiagnosticsStore {
  const of = (merchantId: MerchantId): readonly AnchorDiagnostic[] =>
    deps.store.all(OF_MERCHANT, { merchant: merchantId }).map(diagnosticOf);
  return {
    upsert: (diagnostic) =>
      stored<undefined>(deps, WRITE, () => {
        // The write and the cap in one transaction: between them the table would hold one row more than
        // the policy allows, and a read in between would serve it.
        deps.store.transaction(() => {
          deps.store.run(UPSERT, {
            merchant: diagnostic.merchantId,
            anchor: diagnostic.anchor,
            surface: diagnostic.pageType,
            version: diagnostic.configurationVersion ?? NOT_SAID,
            document: toDocument(diagnostic),
          });
          deps.store.run(BEYOND_THE_CAP, { merchant: diagnostic.merchantId, kept: deps.kept() });
        });
        return undefined;
      }),
    // The set is capped by policy, so the page is taken over the merchant's rows the way the in-memory
    // gateway does: at most `kept` of them, and the cursor means the same thing in both deployments.
    // This is the one read of the feature where a key-based cursor buys nothing — the table is not
    // append-only, a report moves to the front of the order when it repeats.
    listOf: (merchantId, query) => fetched(deps, () => pageOf(of(merchantId), query)),
  };
}
