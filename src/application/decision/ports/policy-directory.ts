// Policy directory port (ADR-026, ADR-027): what a merchant configured for the decision plane —
// its decision policy, its commercial policy and what it declares it can sustain — or the
// defaults when it declared nothing. Configuration today; the configuration API of the
// map (`putFlags`, `createExperiment`) brings hot reload.
import type { CommercialPolicy } from "../../../domain/commercial/index.js";
import type { DecisionPolicy } from "../../../domain/decision/index.js";
import type { MerchantProfile } from "../../../domain/selection/index.js";
import type { MerchantId } from "../../../domain/shared-kernel/index.js";

/** What governs the decisions of a merchant: its three policies. */
export interface PolicySet {
  decision: DecisionPolicy;
  commercial: CommercialPolicy;
  profile: MerchantProfile;
}

export interface MerchantPolicies extends PolicySet {
  /** The kill switch (01 §14.2): off, OPE decides nothing for the merchant and still measures. */
  enabled: boolean;
}

/** Where the policies come from (configuration today, the configuration module later). */
export interface PolicySource {
  policySetFor(merchantId: MerchantId): Promise<PolicySet>;
}

export interface PolicyDirectory {
  policiesFor(merchantId: MerchantId): Promise<MerchantPolicies>;
}
