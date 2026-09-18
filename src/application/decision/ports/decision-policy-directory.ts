// Decision policy directory port (ADR-026): the policy of a merchant — its own, or the default
// one when it declared none. Configuration today (feature 014 brings hot reload).
import type { DecisionPolicy } from "../../../domain/decision/index.js";
import type { MerchantId } from "../../../domain/shared-kernel/index.js";

export interface DecisionPolicyDirectory {
  policyFor(merchantId: MerchantId): Promise<DecisionPolicy>;
}
