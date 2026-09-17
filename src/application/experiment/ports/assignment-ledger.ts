// Port of the assignment ledger (ASSIGNED state of the evidence chain, 01 §5). Keyed by
// merchant, experiment and visitor; recording an existing one keeps the first (idempotent).
// `record` follows ADR-021: accepted into the write buffer, or unavailable.
import type { Assignment } from "../../../domain/experiment/index.js";
import type { ExperimentId, MerchantId, VisitorId } from "../../../domain/shared-kernel/index.js";
import type { RecordOutcome } from "../../shared-kernel/index.js";

export interface AssignmentLedger {
  record(assignment: Assignment): Promise<RecordOutcome> | RecordOutcome;
  find(
    merchantId: MerchantId,
    experimentId: ExperimentId,
    visitorId: VisitorId,
  ): Promise<Assignment | undefined> | Assignment | undefined;
}
