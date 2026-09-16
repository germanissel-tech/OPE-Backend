// Decision ledger port. `find` with another merchant returns undefined: nothing is revealed.
import type { Decision } from "../../../domain/ledger/index.js";
import type { DecisionId, MerchantId } from "../../../domain/shared-kernel/index.js";

export interface DecisionLedger {
  record(decision: Decision): Promise<void> | void;
  find(merchantId: MerchantId, decisionId: DecisionId): Promise<Decision | undefined> | Decision | undefined;
}
