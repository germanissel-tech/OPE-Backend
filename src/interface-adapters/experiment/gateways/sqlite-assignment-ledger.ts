// Assignment ledger on the durable store. Key merchant, experiment and visitor; the first record
// wins, which the primary key decides.
//
// **This is the one of the five where losing the record does not only erase information.** The
// assignment is stable per visitor by design (ADR-022): a visitor who came back after a restart
// used to be assigned again, possibly to the other arm. So the experiment did not just forget
// what it had measured — it started measuring something else, and nothing said so.
import { attempted, type DurableGatewayDeps } from "../../ledger/index.js";
import { fromDocument, toDocument } from "../../shared-kernel/index.js";
import type { AssignmentLedger } from "../../../application/experiment/index.js";
import type { Assignment } from "../../../domain/experiment/index.js";

const INSERT = `INSERT INTO assignments (merchant_id, experiment_id, visitor_id, document)
  VALUES (:merchant, :experiment, :visitor, :document)
  ON CONFLICT (merchant_id, experiment_id, visitor_id) DO NOTHING`;

const BY_VISITOR = `SELECT document FROM assignments
  WHERE merchant_id = :merchant AND experiment_id = :experiment AND visitor_id = :visitor`;

export function sqliteAssignmentLedger(deps: DurableGatewayDeps): AssignmentLedger {
  return {
    record: (assignment) =>
      attempted(deps, "assignment", () => {
        deps.store.run(INSERT, {
          merchant: assignment.merchantId,
          experiment: assignment.experimentId,
          visitor: assignment.visitorId,
          document: toDocument({ ...assignment }),
        });
      }),
    find: (merchantId, experimentId, visitorId) => {
      const rows = deps.store.all(BY_VISITOR, {
        merchant: merchantId,
        experiment: experimentId,
        visitor: visitorId,
      });
      return Promise.resolve(
        rows.length === 0 ? undefined : (fromDocument(String(rows[0]?.["document"])) as Assignment),
      );
    },
  };
}
