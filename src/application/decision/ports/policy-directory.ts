// Policy directory port (ADR-026, ADR-027, ADR-031): what governs the decisions of a merchant
// — its decision policy, its commercial policy, what it declares it can sustain, the barriers
// it enables — resolved by the configuration module value by value over the treatment defaults
// (constitution XI), with the three versions the decision stamps, and its kill switch.
import type { CommercialPolicy } from "../../../domain/commercial/index.js";
import type { DecisionPolicy } from "../../../domain/decision/index.js";
import type { MerchantProfile } from "../../../domain/selection/index.js";
import type { Barrier, ConfigurationVersions, MerchantId } from "../../../domain/shared-kernel/index.js";

/** What governs the decisions of a merchant: its three policies, its active barriers and the versions in force. */
export interface PolicySet {
  decision: DecisionPolicy;
  commercial: CommercialPolicy;
  profile: MerchantProfile;
  /** The barriers OPE may infer for the merchant; the others are never dominant. */
  barriers: readonly Barrier[];
  versions: ConfigurationVersions;
}

export interface MerchantPolicies extends PolicySet {
  /** The kill switch (01 §14.2): off, OPE decides nothing for the merchant and still measures. */
  enabled: boolean;
}

/** Where the policies come from: the configuration module, bound by the composition. */
export interface PolicySource {
  policySetFor(merchantId: MerchantId): Promise<PolicySet>;
}

export interface PolicyDirectory {
  policiesFor(merchantId: MerchantId): Promise<MerchantPolicies>;
}
