// Exposure ledger port. Key (merchant, decision): a repeated one does not duplicate.
// `record` follows ADR-021: the status, or LedgerUnavailable; never throws.
import type { Exposure, LedgerUnavailable, DecisionId } from "../../../domain/ledger/index.js";
import type { MerchantId, Result } from "../../../domain/shared-kernel/index.js";

export type ExposureRecordStatus = "recorded" | "already-recorded";
export type ExposureRecordResult = Result<ExposureRecordStatus, LedgerUnavailable>;

export interface ExposureLedger {
  record(exposure: Exposure): Promise<ExposureRecordResult>;
  find(merchantId: MerchantId, decisionId: DecisionId): Promise<Exposure | undefined>;
}
