// Configuration module (constitution XI; ADR-031): the three levels and their resolution. What it
// needs (`ConfigurationPorts`: the levels of the release, the store of the merchant versions and
// the service that resolves and serves — one instance behind every consumer, so a published
// version counts on the next request), how the release and memory serve its own ports, what it
// serves (the administration of the configuration) and the adapters the consumer modules bind
// to their own read ports (`policySourceOf`, `catalogPoliciesOf`): nobody imports this module.
import { AuditedUseCase, type AdminLog } from "../../application/admin/index.js";
import {
  DefaultConfigurationService,
  GetMerchantConfigurationUseCase,
  GetPlatformConfigurationUseCase,
  GetTreatmentDefaultsUseCase,
  ImportMerchantConfigurationUseCase,
  ListConfigurationVersionsUseCase,
  PublishMerchantConfigurationUseCase,
  type ConfigurationLevels,
  type ConfigurationService,
  type ConfigurationStore,
  type ImportMerchantConfigurationRequest,
  type ImportMerchantConfigurationResponse,
} from "../../application/configuration/index.js";
import { DefaultScopedMerchantService, type MerchantStore } from "../../application/merchant/index.js";
import { memoryConfigurationStore } from "../../interface-adapters/gateways/configuration/memory-configuration-store.js";
import { releaseConfigurationLevels } from "../../interface-adapters/gateways/configuration/release-configuration-levels.js";
import { makeGetMerchantConfiguration } from "../../interface-adapters/http/controllers/configuration/get-merchant-configuration.js";
import { makeGetPlatformConfiguration } from "../../interface-adapters/http/controllers/configuration/get-platform-configuration.js";
import { makeGetTreatmentDefaults } from "../../interface-adapters/http/controllers/configuration/get-treatment-defaults.js";
import { makeListConfigurationVersions } from "../../interface-adapters/http/controllers/configuration/list-configuration-versions.js";
import { makePublishMerchantConfiguration } from "../../interface-adapters/http/controllers/configuration/publish-merchant-configuration.js";
import { auditedWiring } from "./audited.js";
import type { CatalogPolicies } from "../../application/catalog/index.js";
import type { PolicySource } from "../../application/decision/index.js";
import type { ExperimentDirectory, ExperimentStore } from "../../application/experiment/index.js";
import type { Clock, Logger, UseCase } from "../../application/shared-kernel/index.js";
import type { ReleaseLevels } from "../config.js";
import type { Bindings, Module } from "../wiring.js";

export interface ConfigurationPorts {
  clock: Clock;
  logger: Logger;
  levels: ConfigurationLevels;
  configurationStore: ConfigurationStore;
  /** The resolution, shared by every consumer: what it serves changes when a version is published. */
  configuration: ConfigurationService;
  merchantStore: MerchantStore;
  experiments: ExperimentDirectory;
  experimentStore: ExperimentStore;
  adminLog: AdminLog;
}

/** The levels of the release from the files the configuration read; the versions in memory; one service over both. */
export const memoryConfigurationPorts = (
  release: ReleaseLevels,
): Bindings<Pick<ConfigurationPorts, "levels" | "configurationStore" | "configuration">> => {
  let levels: ConfigurationLevels | undefined;
  let store: ConfigurationStore | undefined;
  const theLevels = (): ConfigurationLevels => (levels ??= releaseConfigurationLevels(release));
  const theStore = (): ConfigurationStore => (store ??= memoryConfigurationStore());
  return {
    levels: theLevels,
    configurationStore: theStore,
    configuration: () => new DefaultConfigurationService({ levels: theLevels(), store: theStore() }),
  };
};

/** What the decision plane reads: the policies, the active barriers and the versions of each merchant. */
export const policySourceOf = (configuration: ConfigurationService): PolicySource => ({
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
});

/** What the catalogue reads: the freshness budgets and the level rules of each merchant. */
export const catalogPoliciesOf = (configuration: ConfigurationService): CatalogPolicies => ({
  freshnessFor: async (merchantId) => (await configuration.effectiveFor(merchantId)).values.freshness,
  syncLevelRulesFor: async (merchantId) => (await configuration.effectiveFor(merchantId)).values.syncLevel,
});

/** The configuration the seed declares becomes the version 1 of the merchant, audited as the system (ADR-031). */
export const importConfigurationOf = (
  ports: ConfigurationPorts,
): UseCase<ImportMerchantConfigurationRequest, ImportMerchantConfigurationResponse> =>
  new AuditedUseCase(
    "importMerchantConfiguration",
    new ImportMerchantConfigurationUseCase({
      store: ports.configurationStore,
      configuration: ports.configuration,
      clock: ports.clock,
    }),
    { log: ports.adminLog, clock: ports.clock },
    {
      result: (r) =>
        r.ok && "version" in r.value ? { configurationVersion: r.value.version.version } : undefined,
    },
  );

export const configurationModule: Module<ConfigurationPorts> = ({ ports }) => {
  const { clock, configuration, configurationStore: store, experiments, experimentStore } = ports;
  const { logged, admin } = auditedWiring(ports);
  const scoped = new DefaultScopedMerchantService({ merchants: ports.merchantStore });
  const publish = new PublishMerchantConfigurationUseCase({
    scoped,
    store,
    configuration,
    experiments,
    experimentStore,
    clock,
  });
  return {
    handlers: {
      publishMerchantConfiguration: makePublishMerchantConfiguration(
        admin("publishMerchantConfiguration", publish, {
          result: (r) =>
            r.ok
              ? { configurationVersion: r.value.version.version, windowRestarted: r.value.windowRestarted }
              : undefined,
          reason: (request) => request.reason,
        }),
      ),
      getMerchantConfiguration: makeGetMerchantConfiguration(
        logged(
          "getMerchantConfiguration",
          new GetMerchantConfigurationUseCase({ scoped, store, configuration }),
        ),
      ),
      listConfigurationVersions: makeListConfigurationVersions(
        logged("listConfigurationVersions", new ListConfigurationVersionsUseCase({ scoped, store })),
      ),
      getPlatformConfiguration: makeGetPlatformConfiguration(
        logged("getPlatformConfiguration", new GetPlatformConfigurationUseCase({ configuration })),
      ),
      getTreatmentDefaults: makeGetTreatmentDefaults(
        logged("getTreatmentDefaults", new GetTreatmentDefaultsUseCase({ configuration })),
      ),
    },
  };
};
