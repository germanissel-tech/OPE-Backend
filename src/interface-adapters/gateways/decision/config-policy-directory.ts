// Policy source over the configured merchants (local profile): what each merchant declared,
// completed with the defaults, resolved once at start. A merchant nobody configured also gets
// the defaults: the policies never block a decision, the credential does. The kill switch is
// not here: the store knows it (switch-aware-policy-directory.ts).
import { DEFAULT_COMMERCIAL_POLICY } from "../../../domain/commercial/index.js";
import { DEFAULT_DECISION_POLICY } from "../../../domain/decision/index.js";
import { EMPTY_PROFILE } from "../../../domain/selection/index.js";
import type { PolicySet, PolicySource } from "../../../application/decision/index.js";
import type { MerchantId } from "../../../domain/shared-kernel/index.js";

export interface ConfiguredPolicies extends Partial<PolicySet> {
  merchantId: MerchantId;
}

const DEFAULTS: PolicySet = {
  decision: DEFAULT_DECISION_POLICY,
  commercial: DEFAULT_COMMERCIAL_POLICY,
  profile: EMPTY_PROFILE,
};

export function configPolicySource(merchants: readonly ConfiguredPolicies[]): PolicySource {
  const policies = new Map<MerchantId, PolicySet>();
  for (const { merchantId, ...declared } of merchants) {
    policies.set(merchantId, {
      decision: declared.decision ?? DEFAULTS.decision,
      commercial: declared.commercial ?? DEFAULTS.commercial,
      profile: declared.profile ?? DEFAULTS.profile,
    });
  }
  return { policySetFor: (merchantId) => Promise.resolve(policies.get(merchantId) ?? DEFAULTS) };
}
