// Port of the assignment ledger (ASSIGNED state of the evidence chain, 01 §5). Keyed by
// merchant, experiment and visitor; recording an existing one keeps the first (idempotent).
// `record` follows ADR-021: accepted into the write buffer, or LedgerUnavailable; never throws.
import type { Assignment } from "../../../domain/experiment/index.js";
import type { LedgerUnavailable } from "../../../domain/ledger/index.js";
import type { ExperimentId, MerchantId, Result, VisitorId } from "../../../domain/shared-kernel/index.js";

export type AssignmentRecordResult = Result<void, LedgerUnavailable>;

export interface AssignmentLedger {
  record(assignment: Assignment): Promise<AssignmentRecordResult> | AssignmentRecordResult;
  find(
    merchantId: MerchantId,
    experimentId: ExperimentId,
    visitorId: VisitorId,
  ): Promise<Assignment | undefined> | Assignment | undefined;
}
