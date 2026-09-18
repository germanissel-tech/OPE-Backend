// Decision policy directory over the configured merchants (local profile): the merchant's
// policy, or the default one, resolved once at start. A merchant nobody configured also gets
// the default: the policy never blocks a decision, the credential does.
import { DEFAULT_DECISION_POLICY, type DecisionPolicy } from "../../../domain/decision/index.js";
import type { DecisionPolicyDirectory } from "../../../application/decision/index.js";
import type { MerchantId } from "../../../domain/shared-kernel/index.js";

export interface MerchantPolicy {
  merchantId: MerchantId;
  policy?: DecisionPolicy;
}

export function configDecisionPolicyDirectory(merchants: readonly MerchantPolicy[]): DecisionPolicyDirectory {
  const policies = new Map<MerchantId, DecisionPolicy>();
  for (const { merchantId, policy } of merchants) if (policy) policies.set(merchantId, policy);
  return { policyFor: (merchantId) => Promise.resolve(policies.get(merchantId) ?? DEFAULT_DECISION_POLICY) };
}
