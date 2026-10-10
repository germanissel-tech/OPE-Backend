// Configuration module (constitution XI; ADR-031): the three levels and their resolution. It owns
// the levels of the release, the store of the merchant versions and the service that resolves and
// serves —one instance behind every consumer, so a published version counts on the next request—
// and it binds the read ports its consumers declare: the policies of the decision plane, the
// budgets of the catalogue and the holdout of the experiment. Nobody imports it for that.
import {
  CompleteLocales,
  Configurations,
  GetMerchantConfigurationUseCase,
  GetMerchantConfigurationVersionUseCase,
  GetLevelVersionUseCase,
  GetPlatformConfigurationUseCase,
  GetTreatmentDefaultsUseCase,
  ImportConfigurationLevelsUseCase,
  ImportMerchantConfigurationUseCase,
  ListConfigurationVersionsUseCase,
  ListLevelVersionsUseCase,
  PublishMerchantConfigurationUseCase,
  PublishLevelUseCase,
  ReachedExperiments,
  type ConfigurationLevels,
  type ConfigurationService,
  type ConfigurationStore,
  type ImportConfigurationLevelsRequest,
  type ImportConfigurationLevelsResponse,
  type LevelStore,
  type LevelVersionRead,
  type ListLevelVersionsRequest,
  type ImportMerchantConfigurationRequest,
  type ImportMerchantConfigurationResponse,
  type PlatformLevelReader,
  type PublishLevelRequest,
  type PublishLevelResponse,
  type PublishMerchantConfigurationRequest,
  type TextCompleteness,
  readTreatmentDefaults,
} from "../../application/configuration/index.js";
import {
  ActiveExperiments,
  WindowRestarts,
  type ExperimentDirectory,
  type ExperimentStore,
} from "../../application/experiment/index.js";
import {
  catalogPoliciesOf,
  holdoutSourceOf,
  makeGetMerchantConfiguration,
  makeGetPlatformConfiguration,
  makeGetMerchantConfigurationVersion,
  makeGetPlatformConfigurationVersion,
  makeGetTreatmentDefaults,
  makeGetTreatmentDefaultsVersion,
  makeListConfigurationVersions,
  makeListPlatformConfigurationVersions,
  makeListTreatmentDefaultsVersions,
  makePublishMerchantConfiguration,
  makePublishPlatformConfiguration,
  makePublishTreatmentDefaults,
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
import { PlatformLevelPort, SqlStorePort } from "../release.js";
import { CatalogPoliciesPort } from "./catalog.js";
import { PolicyDirectoryPort } from "./decision.js";
import { ExperimentDirectoryPort, ExperimentStorePort, HoldoutPort } from "./experiment.js";
import { MerchantStorePort, ScopedMerchantPort } from "./merchant.js";
import { MessageDirectoryPort, TextStorePort } from "./messages.js";
import { AuditPort, ClockPort, LoggerPort } from "./shared-kernel.js";
import type { MerchantStore } from "../../application/merchant/index.js";
import type { Clock, Page, UseCase } from "../../application/shared-kernel/index.js";

const ConfigurationLevelsPort = port("configuration.levels")<ConfigurationLevels>();
const ConfigurationStorePort = port("configuration.store")<ConfigurationStore>();
/** The versions of the two levels of the release, which an operator publishes (feature 036). */
const LevelStorePort = port("configuration.level-store")<LevelStore>();
/** The resolution, shared by every consumer: what it serves changes when a version is published. */
export const ConfigurationServicePort = port("configuration.service")<ConfigurationService>();
/** Whether a language could be served: which families the base texts lack in it (feature 038, US4). */
const TextCompletenessPort = port("configuration.text-completeness")<TextCompleteness>();
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
  // each level, and the files are the seed the boot imports into an empty store.
  bind(ConfigurationLevelsPort, { levels: LevelStorePort }, ({ levels }) =>
    storedConfigurationLevels(levels),
  ),
  bind(
    ConfigurationServicePort,
    { levels: ConfigurationLevelsPort, store: ConfigurationStorePort },
    (deps) => new Configurations(deps),
  ),
  // **The level 1 reader, which is the same instance that resolves** and not a second copy of it: two caches
  // of one level can disagree, and the one that nobody notices disagreeing is the one the decision path
  // reads. The eleven components that used to receive a value at construction receive this and ask when they
  // use it (research R-02).
  bind(
    PlatformLevelPort,
    { configuration: ConfigurationServicePort },
    ({ configuration }): PlatformLevelReader => ({ inForce: () => configuration.platformInForce() }),
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

/**
 * What a publication of a level needs, and how the use case the two levels share is built (feature 036).
 *
 * `ReachedExperiments` is built **here** and handed over as one dependency, which is what keeps the use case
 * inside the six of ADR-023 — and what gives the question «who does this change reach» a name of its own.
 */
const PUBLISHES_A_LEVEL = {
  levels: LevelStorePort,
  configuration: ConfigurationServicePort,
  merchants: MerchantStorePort,
  configurations: ConfigurationStorePort,
  experiments: ExperimentDirectoryPort,
  experimentStore: ExperimentStorePort,
  clock: ClockPort,
} as const;

const publishesALevel = (deps: {
  levels: LevelStore;
  configuration: ConfigurationService;
  clock: Clock;
  merchants: MerchantStore;
  configurations: ConfigurationStore;
  experiments: ExperimentDirectory;
  experimentStore: ExperimentStore;
}): PublishLevelUseCase => {
  const { levels, configuration, clock, experimentStore, merchants, experiments, configurations } = deps;
  // The walk and the restart are the experiment module's (feature 038); who is reached stays here.
  const reached = new ReachedExperiments({
    configurations,
    active: new ActiveExperiments({ merchants, experiments }),
    restarts: new WindowRestarts({ experimentStore }),
  });
  return new PublishLevelUseCase({ levels, configuration, clock, reached });
};

/**
 * What the administration log keeps of a publication of a level: the number it got and what it restarted.
 *
 * The two readers are named and the object that carries them is written at each `served`, which is the
 * shape rule `port-implementations-only-in-bind` and not a style: an object with behaviour hoisted into the
 * wiring reads like a component the graph does not know it has, and the readers of a decorator are
 * arguments.
 */
const levelVersionNumbered = (r: PublishLevelResponse) =>
  r.ok
    ? { configurationVersion: r.value.version.version, windowRestarted: r.value.windowsRestarted.length > 0 }
    : undefined;

const levelReasonDeclared = (request: PublishLevelRequest) => request.reason;

/** What a read of a level's history needs, which is the store of the versions and nothing else. */
/** A reading of a merchant's history, within the scope, also asks the experiments what each version restarted. */
const READS_A_MERCHANT_VERSION = {
  scoped: ScopedMerchantPort,
  store: ConfigurationStorePort,
  experimentStore: ExperimentStorePort,
} as const;

/** A reading of a level's history also asks the experiments what each version restarted (feature 042). */
const READS_A_LEVEL = { levels: LevelStorePort, experimentStore: ExperimentStorePort } as const;

/**
 * The languages a level's content declares, read by the reader of the level: an invalid content declares
 * none here and is refused by the use case, which names the field. Only the treatment defaults carry
 * languages, and only they are wrapped (feature 038, US4).
 */
const localesOfDefaults = (content: Record<string, unknown>) => {
  // The reader wants the level named; a placeholder stands in for the shape of the check, as it does when
  // the use case judges the content, and it is never stored.
  const read = readTreatmentDefaults({ ...content, version: DEFAULTS_DRAFT });
  return read.ok ? read.value.values.locales : undefined;
};
const DEFAULTS_DRAFT = "defaults-draft";

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
    // The store of the texts answers the question as it is: what it lacks for a language is what the
    // question asks (feature 038, US4).
    bind(TextCompletenessPort, { texts: TextStorePort }, ({ texts }) => texts),
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
      // Feature 036: the two levels of the release, published by the **one** use case they share. What each
      // handler adds is the level it names; everything else — the components it needs, how the use case is
      // built and what the audit entry keeps — is written once right above.
      publishPlatformConfiguration: served(
        PUBLISHES_A_LEVEL,
        { name: "publishPlatformConfiguration", build: publishesALevel },
        (useCase) => makePublishPlatformConfiguration(useCase),
        { result: levelVersionNumbered, reason: levelReasonDeclared },
      ),
      publishTreatmentDefaults: served(
        { ...PUBLISHES_A_LEVEL, completeness: TextCompletenessPort },
        {
          name: "publishTreatmentDefaults",
          // A language enters the defaults only with a complete base (feature 038, US4): the check wraps
          // the use case, which stays the one its twin shares.
          build: ({ completeness, ...deps }) =>
            new CompleteLocales<PublishLevelRequest, PublishLevelResponse>(
              publishesALevel(deps),
              { completeness },
              {
                declared: (request) => localesOfDefaults(request.content),
                inForce: async (request) => {
                  const latest = await deps.levels.latestOf(request.level);
                  return latest === undefined ? undefined : localesOfDefaults(latest.content);
                },
                at: "content.locales",
              },
            ),
        },
        (useCase) => makePublishTreatmentDefaults(useCase),
        { result: levelVersionNumbered, reason: levelReasonDeclared },
      ),
      publishMerchantConfiguration: served(
        {
          scoped: ScopedMerchantPort,
          store: ConfigurationStorePort,
          configuration: ConfigurationServicePort,
          experiments: ExperimentDirectoryPort,
          experimentStore: ExperimentStorePort,
          clock: ClockPort,
          completeness: TextCompletenessPort,
        },
        {
          name: "publishMerchantConfiguration",
          build: ({ experimentStore, completeness, ...deps }) =>
            new CompleteLocales(
              new PublishMerchantConfigurationUseCase({
                ...deps,
                restarts: new WindowRestarts({ experimentStore }),
              }),
              { completeness },
              {
                declared: (request: PublishMerchantConfigurationRequest) => request.declared.locales,
                inForce: async (request) => (await deps.store.latestOf(request.merchantId))?.declared.locales,
                at: "declared.locales",
              },
            ),
        },
        (useCase) => makePublishMerchantConfiguration(useCase),
        {
          result: (r) =>
            r.ok
              ? {
                  configurationVersion: r.value.version.version,
                  windowRestarted: r.value.windowsRestarted.length > 0,
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
        READS_A_MERCHANT_VERSION,
        {
          name: "listConfigurationVersions",
          build: ({ experimentStore, ...deps }) =>
            new ListConfigurationVersionsUseCase({
              ...deps,
              restarts: new WindowRestarts({ experimentStore }),
            }),
        },
        (useCase) => makeListConfigurationVersions(useCase),
      ),
      // One version by its number (feature 042), the same one its page carries.
      getMerchantConfigurationVersion: served(
        READS_A_MERCHANT_VERSION,
        {
          name: "getMerchantConfigurationVersion",
          build: ({ experimentStore, ...deps }) =>
            new GetMerchantConfigurationVersionUseCase({
              ...deps,
              restarts: new WindowRestarts({ experimentStore }),
            }),
        },
        (useCase) => makeGetMerchantConfigurationVersion(useCase),
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
      // The history of each level (feature 036, US4): four operations over the two use cases that read it,
      // because what differs between them is the level the controller names.
      listPlatformConfigurationVersions: served(
        READS_A_LEVEL,
        {
          name: "listPlatformConfigurationVersions",
          // Annotated, and the compiler asks for it: the recipe of a handler fixes the request to `unknown`
          // unless the builder says what the use case is, and a listing answers a page rather than a
          // `Result`, so there is no error union to infer it from.
          build: ({ levels, experimentStore }): UseCase<ListLevelVersionsRequest, Page<LevelVersionRead>> =>
            new ListLevelVersionsUseCase({ levels, restarts: new WindowRestarts({ experimentStore }) }),
        },
        (useCase) => makeListPlatformConfigurationVersions(useCase),
      ),
      listTreatmentDefaultsVersions: served(
        READS_A_LEVEL,
        {
          name: "listTreatmentDefaultsVersions",
          build: ({ levels, experimentStore }): UseCase<ListLevelVersionsRequest, Page<LevelVersionRead>> =>
            new ListLevelVersionsUseCase({ levels, restarts: new WindowRestarts({ experimentStore }) }),
        },
        (useCase) => makeListTreatmentDefaultsVersions(useCase),
      ),
      getPlatformConfigurationVersion: served(
        READS_A_LEVEL,
        {
          name: "getPlatformConfigurationVersion",
          build: ({ levels, experimentStore }) =>
            new GetLevelVersionUseCase({ levels, restarts: new WindowRestarts({ experimentStore }) }),
        },
        (useCase) => makeGetPlatformConfigurationVersion(useCase),
      ),
      getTreatmentDefaultsVersion: served(
        READS_A_LEVEL,
        {
          name: "getTreatmentDefaultsVersion",
          build: ({ levels, experimentStore }) =>
            new GetLevelVersionUseCase({ levels, restarts: new WindowRestarts({ experimentStore }) }),
        },
        (useCase) => makeGetTreatmentDefaultsVersion(useCase),
      ),
    },
  },
});
