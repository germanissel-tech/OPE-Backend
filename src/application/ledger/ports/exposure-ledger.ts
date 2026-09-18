// Exposure ledger port. Key (merchant, decision): a repeated one does not duplicate.
// `record` follows ADR-021: the status, or LedgerUnavailable; never throws.
import type { Exposure, LedgerUnavailable } from "../../../domain/ledger/index.js";
import type { DecisionId, MerchantId, Result } from "../../../domain/shared-kernel/index.js";

export type ExposureRecordStatus = "recorded" | "already-recorded";
export type ExposureRecordResult = Result<ExposureRecordStatus, LedgerUnavailable>;

export interface ExposureLedger {
  record(exposure: Exposure): Promise<ExposureRecordResult> | ExposureRecordResult;
  find(merchantId: MerchantId, decisionId: DecisionId): Promise<Exposure | undefined> | Exposure | undefined;
}
