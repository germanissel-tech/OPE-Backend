// Configuration module (constitution XI; ADR-031): the three levels and their resolution. It owns
// the levels of the release, the store of the merchant versions and the service that resolves and
// serves —one instance behind every consumer, so a published version counts on the next request—
// and it binds the read ports its consumers declare: the policies of the decision plane, the
// budgets of the catalogue and the holdout of the experiment. Nobody imports it for that.
import {
  Configurations,
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
import {
  catalogPoliciesOf,
  holdoutSourceOf,
  makeGetMerchantConfiguration,
  makeGetPlatformConfiguration,
  makeGetTreatmentDefaults,
  makeListConfigurationVersions,
  makePublishMerchantConfiguration,
  memoryConfigurationStore,
  policySourceOf,
  releaseConfigurationLevels,
  switchAwarePolicyDirectory,
  messageSettingsOf,
} from "../../interface-adapters/configuration/index.js";
import { bind, compositionModule, served, port } from "../graph/index.js";
import { ReleaseLevelsPort } from "../release.js";
import { CatalogPoliciesPort } from "./catalog.js";
import { PolicyDirectoryPort } from "./decision.js";
import { ExperimentDirectoryPort, ExperimentStorePort, HoldoutPort } from "./experiment.js";
import { MerchantStorePort, ScopedMerchantPort } from "./merchant.js";
import { MessageDirectoryPort } from "./messages.js";
import { AuditPort, ClockPort } from "./shared-kernel.js";
import type { UseCase } from "../../application/shared-kernel/index.js";

const ConfigurationLevelsPort = port("configuration.levels")<ConfigurationLevels>();
const ConfigurationStorePort = port("configuration.store")<ConfigurationStore>();
/** The resolution, shared by every consumer: what it serves changes when a version is published. */
export const ConfigurationServicePort = port("configuration.service")<ConfigurationService>();
/** The configuration a merchant declares in the seed becomes its version 1, audited as the system. */
export const ImportConfigurationPort =
  port("configuration.import")<
    UseCase<ImportMerchantConfigurationRequest, ImportMerchantConfigurationResponse>
  >();

export const configurationModule = compositionModule({
  provides: [
    bind(ConfigurationLevelsPort, { release: ReleaseLevelsPort }, ({ release }) =>
      releaseConfigurationLevels(release),
    ),
    bind(ConfigurationStorePort, {}, () => memoryConfigurationStore()),
    bind(
      ConfigurationServicePort,
      { levels: ConfigurationLevelsPort, store: ConfigurationStorePort },
      (deps) => new Configurations(deps),
    ),
    bind(CatalogPoliciesPort, { configuration: ConfigurationServicePort }, ({ configuration }) =>
      catalogPoliciesOf(configuration),
    ),
    bind(HoldoutPort, { configuration: ConfigurationServicePort }, ({ configuration }) =>
      holdoutSourceOf(configuration),
    ),
    bind(MessageDirectoryPort, { configuration: ConfigurationServicePort }, ({ configuration }) =>
      messageSettingsOf(configuration),
    ),
    bind(
      PolicyDirectoryPort,
      { configuration: ConfigurationServicePort, merchants: MerchantStorePort },
      ({ configuration, merchants }) => switchAwarePolicyDirectory(policySourceOf(configuration), merchants),
    ),
  ],
  assembles: [
    bind(
      ImportConfigurationPort,
      {
        audit: AuditPort,
        store: ConfigurationStorePort,
        configuration: ConfigurationServicePort,
        clock: ClockPort,
      },
      ({ audit, ...deps }) =>
        audit("importMerchantConfiguration", new ImportMerchantConfigurationUseCase(deps), {
          result: (r) =>
            r.ok && "version" in r.value ? { configurationVersion: r.value.version.version } : undefined,
        }),
    ),
  ],
  serves: {
    handlers: {
      publishMerchantConfiguration: served(
        {
          scoped: ScopedMerchantPort,
          store: ConfigurationStorePort,
          configuration: ConfigurationServicePort,
          experiments: ExperimentDirectoryPort,
          experimentStore: ExperimentStorePort,
          clock: ClockPort,
        },
        {
          name: "publishMerchantConfiguration",
          build: ({ experimentStore, ...deps }) =>
            new PublishMerchantConfigurationUseCase({ ...deps, experimentStore }),
        },
        (useCase) => makePublishMerchantConfiguration(useCase),
        {
          result: (r) =>
            r.ok
              ? {
                  configurationVersion: r.value.version.version,
                  windowRestarted: r.value.windowRestarted,
                }
              : undefined,
          reason: (request) => request.reason,
        },
      ),
      getMerchantConfiguration: served(
        {
          scoped: ScopedMerchantPort,
          store: ConfigurationStorePort,
          configuration: ConfigurationServicePort,
        },
        { name: "getMerchantConfiguration", build: (deps) => new GetMerchantConfigurationUseCase(deps) },
        (useCase) => makeGetMerchantConfiguration(useCase),
      ),
      listConfigurationVersions: served(
        { scoped: ScopedMerchantPort, store: ConfigurationStorePort },
        { name: "listConfigurationVersions", build: (deps) => new ListConfigurationVersionsUseCase(deps) },
        (useCase) => makeListConfigurationVersions(useCase),
      ),
      getPlatformConfiguration: served(
        { configuration: ConfigurationServicePort },
        { name: "getPlatformConfiguration", build: (deps) => new GetPlatformConfigurationUseCase(deps) },
        (useCase) => makeGetPlatformConfiguration(useCase),
      ),
      getTreatmentDefaults: served(
        { configuration: ConfigurationServicePort },
        { name: "getTreatmentDefaults", build: (deps) => new GetTreatmentDefaultsUseCase(deps) },
        (useCase) => makeGetTreatmentDefaults(useCase),
      ),
    },
  },
});
