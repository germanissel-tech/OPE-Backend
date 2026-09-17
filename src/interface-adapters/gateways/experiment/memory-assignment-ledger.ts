// Assignment ledger in memory. Composite key merchant + experiment + visitor; the first record
// wins (idempotent), and a merchant never sees another merchant's assignments.
import type { AssignmentLedger } from "../../../application/experiment/index.js";
import type { Assignment } from "../../../domain/experiment/index.js";
import type { ExperimentId, MerchantId, VisitorId } from "../../../domain/shared-kernel/index.js";

export function memoryAssignmentLedger(): AssignmentLedger {
  const assignments = new Map<string, Assignment>();
  const key = (m: MerchantId, e: ExperimentId, v: VisitorId): string => `${m}/${e}/${v}`;
  return {
    record(assignment) {
      const k = key(assignment.merchantId, assignment.experimentId, assignment.visitorId);
      if (!assignments.has(k)) assignments.set(k, assignment);
      return "accepted";
    },
    find(merchantId, experimentId, visitorId) {
      return assignments.get(key(merchantId, experimentId, visitorId));
    },
  };
}
