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
  ImportConfigurationLevelsUseCase,
  ImportMerchantConfigurationUseCase,
  ListConfigurationVersionsUseCase,
  PublishMerchantConfigurationUseCase,
  type ConfigurationLevels,
  type ConfigurationService,
  type ConfigurationStore,
  type ImportConfigurationLevelsRequest,
  type ImportConfigurationLevelsResponse,
  type LevelStore,
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
  memoryLevelStore,
  sqliteConfigurationStore,
  sqliteLevelStore,
  policySourceOf,
  storedConfigurationLevels,
  switchAwarePolicyDirectory,
  messageSettingsOf,
} from "../../interface-adapters/configuration/index.js";
import { bind, compositionModule, served, port } from "../graph/index.js";
import { SqlStorePort } from "../release.js";
import { CatalogPoliciesPort } from "./catalog.js";
import { PolicyDirectoryPort } from "./decision.js";
import { ExperimentDirectoryPort, ExperimentStorePort, HoldoutPort } from "./experiment.js";
import { MerchantStorePort, ScopedMerchantPort } from "./merchant.js";
import { MessageDirectoryPort } from "./messages.js";
import { AuditPort, ClockPort, LoggerPort } from "./shared-kernel.js";
import type { UseCase } from "../../application/shared-kernel/index.js";

const ConfigurationLevelsPort = port("configuration.levels")<ConfigurationLevels>();
const ConfigurationStorePort = port("configuration.store")<ConfigurationStore>();
/** The versions of the two levels of the release, which an operator publishes (feature 036). */
const LevelStorePort = port("configuration.level-store")<LevelStore>();
/** The resolution, shared by every consumer: what it serves changes when a version is published. */
export const ConfigurationServicePort = port("configuration.service")<ConfigurationService>();
/** The two levels of the release become version 1 of each, audited as the system (feature 036). */
export const ImportConfigurationLevelsPort = port("configuration.import-levels")<
  UseCase<ImportConfigurationLevelsRequest, ImportConfigurationLevelsResponse>
>();
/** The configuration a merchant declares in the seed becomes its version 1, audited as the system. */
export const ImportConfigurationPort =
  port("configuration.import")<
    UseCase<ImportMerchantConfigurationRequest, ImportMerchantConfigurationResponse>
  >();

/**
 * What this module provides whatever serves the versions: the levels of the release, the resolution and
 * the four read views its consumers declare. Written once and spread into the two technologies, because
 * the day a fifth view is added, adding it under one and forgetting the other is a deployment that
 * silently lacks it.
 *
 * **And they stay in `provides` rather than moving to `assembles`, which is not a matter of taste.**
 * `providedPorts` is what a test replaces when it resets the components (`sharedTestApp`), and
 * `Configurations` **memoises** the effective configuration of every merchant. Under `assembles` that
 * memo outlives the reset, and the next test is served the configuration of the previous one — which is
 * exactly what happened when it was tried (feature 033, US2).
 */
const resolution = [
  // **The release stopped being the source here** (feature 036): what is in force is the newest version of
  // each level, and the files are the seed the boot imports into an empty store. Until the story that gives
  // the platform level its reader, the eleven components that receive one of its values at construction
  // still take it from the file (`PlatformConfigurationPort`) — and the two cannot disagree yet, because
  // nothing can publish that level until then.
  bind(ConfigurationLevelsPort, { levels: LevelStorePort }, ({ levels }) =>
    storedConfigurationLevels(levels),
  ),
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
] as const;

export const configurationModule = compositionModule({
  // The only component with a technology to choose is the store of the published versions; the rest is
  // the same in every deployment and is spread in from `resolution`.
  provides: {
    memory: [
      bind(ConfigurationStorePort, {}, () => memoryConfigurationStore()),
      bind(LevelStorePort, {}, () => memoryLevelStore()),
      ...resolution,
    ],
    sqlite: [
      bind(ConfigurationStorePort, { store: SqlStorePort, logger: LoggerPort }, (deps) =>
        sqliteConfigurationStore(deps),
      ),
      bind(LevelStorePort, { store: SqlStorePort, logger: LoggerPort }, (deps) => sqliteLevelStore(deps)),
      ...resolution,
    ],
  },
  assembles: [
    // **Without a result, and that is D-29 and not an oversight.** `AdminResult` is a published schema of
    // the contract with three fields, none of which is «which levels were imported»; saying it would be a
    // contract change, and this feature declared it does not make one. The log line of the boot does say it.
    bind(
      ImportConfigurationLevelsPort,
      { audit: AuditPort, levels: LevelStorePort, clock: ClockPort },
      ({ audit, ...deps }) => audit("importConfigurationLevels", new ImportConfigurationLevelsUseCase(deps)),
    ),
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
