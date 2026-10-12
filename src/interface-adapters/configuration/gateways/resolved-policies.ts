// What each consumer reads of the effective configuration of a merchant (constitution XI,
// ADR-031). Every consumer declares its own read port and this module, which can see them all,
// implements it over the resolution: the decision plane reads the policies and the active
// barriers, the catalogue its freshness budgets and level rules, the experiment the holdout, the platform
// how each flow arrives.
import type { CatalogPolicies } from "../../../application/catalog/index.js";
import type { ConfigurationService } from "../../../application/configuration/index.js";
import type { PolicySource } from "../../../application/decision/index.js";
import type { HoldoutSource } from "../../../application/experiment/index.js";
import type { PlatformPolicies } from "../../../application/platform/index.js";
import type { SyncStrategies } from "../../../application/shared-kernel/index.js";

/** What the decision plane reads: the policies, the active barriers and the versions of each merchant. */
export function policySourceOf(configuration: ConfigurationService): PolicySource {
  return {
    async policySetFor(merchantId) {
      const effective = await configuration.effectiveFor(merchantId);
      const { decisionPolicy, commercialPolicy, evidenceProfile, barriers } = effective.values;
      return {
        decision: decisionPolicy,
        commercial: commercialPolicy,
        profile: evidenceProfile,
        barriers,
        versions: effective.versions,
      };
    },
  };
}

/** What the catalogue reads: the freshness budgets and the level rules of each merchant. */
export function catalogPoliciesOf(configuration: ConfigurationService): CatalogPolicies {
  return {
    freshnessFor: async (merchantId) => (await configuration.effectiveFor(merchantId)).values.freshness,
    syncLevelRulesFor: async (merchantId) => (await configuration.effectiveFor(merchantId)).values.syncLevel,
  };
}

/** What the platform reads: the mode each flow of a merchant arrives by (feature 044). */
export function syncStrategiesOf(configuration: ConfigurationService): SyncStrategies {
  return {
    modeOf: async (merchantId, flow) =>
      (await configuration.effectiveFor(merchantId)).values.syncStrategy[flow],
  };
}

/** What the scheduler reads of a merchant: its source, the mode of each flow, the cadence and the confirmation. */
export function platformPoliciesOf(configuration: ConfigurationService): PlatformPolicies {
  return {
    async policyFor(merchantId) {
      const { platformSource, syncStrategy, syncCadence, orderConfirmation } = (
        await configuration.effectiveFor(merchantId)
      ).values;
      return {
        source: platformSource,
        strategy: syncStrategy,
        cadence: syncCadence,
        confirmation: orderConfirmation,
      };
    },
  };
}

/** What the experiment reads: the share of traffic the merchant keeps out of OPE. */
export function holdoutSourceOf(configuration: ConfigurationService): HoldoutSource {
  return {
    holdoutShareFor: async (merchantId) => (await configuration.effectiveFor(merchantId)).values.holdoutShare,
  };
}
