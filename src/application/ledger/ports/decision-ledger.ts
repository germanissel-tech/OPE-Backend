// Decision ledger port. `find` with another merchant returns undefined: nothing is revealed.
// `record` follows ADR-021: accepted into the write buffer, or LedgerUnavailable; never throws.
import type { Decision, LedgerUnavailable, DecisionId } from "../../../domain/ledger/index.js";
import type { MerchantId, Result } from "../../../domain/shared-kernel/index.js";

export type RecordResult = Result<void, LedgerUnavailable>;

export interface DecisionLedger {
  record(decision: Decision): Promise<RecordResult>;
  find(merchantId: MerchantId, decisionId: DecisionId): Promise<Decision | undefined>;
}
