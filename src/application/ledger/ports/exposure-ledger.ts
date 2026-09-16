// Exposure ledger port. Key (merchant, decision): a repeated one does not duplicate.
import type { Exposure } from "../../../domain/ledger/index.js";
import type { DecisionId, MerchantId } from "../../../domain/shared-kernel/index.js";

export type ExposureRecordStatus = "recorded" | "already-recorded";

export interface ExposureLedger {
  record(exposure: Exposure): Promise<ExposureRecordStatus> | ExposureRecordStatus;
  find(merchantId: MerchantId, decisionId: DecisionId): Promise<Exposure | undefined> | Exposure | undefined;
}
