// Exposure ledger on the durable store. Key merchant plus decision, as in memory.
//
// **This is where idempotency stops being a property of a process that is still up.** Confirming
// twice answered `already-recorded` before, but only until the next restart emptied the `Map`;
// now the primary key of the table is what answers, so the guarantee holds across one (FR-005).
//
// `ON CONFLICT DO NOTHING` plus the count of what changed is what decides it in **one** statement:
// asking first and writing after would leave a gap, and the whole point of a key is that the
// store decides, not the caller.
import { toDocument, fromDocument } from "../../shared-kernel/index.js";
import { attempted, type DurableGatewayDeps } from "./durable-write.js";
import type { ExposureLedger } from "../../../application/ledger/index.js";
import type { Exposure } from "../../../domain/ledger/index.js";

const INSERT = `INSERT INTO exposures (merchant_id, decision_id, document)
  VALUES (:merchant, :decision, :document)
  ON CONFLICT (merchant_id, decision_id) DO NOTHING`;

/** What the insert did, asked of the store rather than remembered: 1 when it wrote, 0 when the key was taken. */
const CHANGED = `SELECT changes() AS changed`;

const BY_DECISION = `SELECT document FROM exposures WHERE merchant_id = :merchant AND decision_id = :decision`;

export function sqliteExposureLedger(deps: DurableGatewayDeps): ExposureLedger {
  return {
    record: (exposure) =>
      attempted(deps, "exposure", () =>
        // Both statements run inside one transaction so that `changes()` reports this insert and
        // not somebody else's: it is per connection, and a write that slipped in between would
        // make a first confirmation look like a repeat.
        deps.store.transaction(() => {
          deps.store.run(INSERT, {
            merchant: exposure.merchantId,
            decision: exposure.decisionId,
            document: toDocument({ ...exposure }),
          });
          return deps.store.all(CHANGED)[0]?.["changed"] === 1 ? "recorded" : "already-recorded";
        }),
      ),
    find: (merchantId, decisionId) => {
      const rows = deps.store.all(BY_DECISION, { merchant: merchantId, decision: decisionId });
      return Promise.resolve(
        rows.length === 0 ? undefined : (fromDocument(String(rows[0]?.["document"])) as Exposure),
      );
    },
  };
}
