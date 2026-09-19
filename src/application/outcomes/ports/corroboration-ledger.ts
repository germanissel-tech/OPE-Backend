// Corroboration ledger port (ADR-028): mechanism B evidence, one record per merchant, order and
// session (the first wins). Joined to the order by identity, never copied into it.
import type { LedgerUnavailable } from "../../../domain/ledger/index.js";
import type { Corroboration, OrderId } from "../../../domain/outcomes/index.js";
import type { MerchantId, Result } from "../../../domain/shared-kernel/index.js";

export type CorroborationRecordStatus = "recorded" | "repeated";

export interface CorroborationLedger {
  record(corroboration: Corroboration): Promise<Result<CorroborationRecordStatus, LedgerUnavailable>>;
  find(merchantId: MerchantId, orderId: OrderId): Promise<readonly Corroboration[]>;
}
