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
} from "../../interface-adapters/configuration/index.js";
import { bind, compositionModule, handler, port } from "../graph/index.js";
import { ReleaseLevelsPort } from "../release.js";
import { CatalogPoliciesPort } from "./catalog.js";
import { PolicyDirectoryPort } from "./decision.js";
import { ExperimentDirectoryPort, ExperimentStorePort, HoldoutPort } from "./experiment.js";
import { MerchantStorePort, ScopedMerchantPort } from "./merchant.js";
import { ClockPort, DecoratorsPort } from "./shared-kernel.js";
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
        deco: DecoratorsPort,
        store: ConfigurationStorePort,
        configuration: ConfigurationServicePort,
        clock: ClockPort,
      },
      ({ deco, ...deps }) =>
        deco.audited("importMerchantConfiguration", new ImportMerchantConfigurationUseCase(deps), {
          result: (r) =>
            r.ok && "version" in r.value ? { configurationVersion: r.value.version.version } : undefined,
        }),
    ),
  ],
  serves: {
    handlers: {
      publishMerchantConfiguration: handler(
        {
          deco: DecoratorsPort,
          scoped: ScopedMerchantPort,
          store: ConfigurationStorePort,
          configuration: ConfigurationServicePort,
          experiments: ExperimentDirectoryPort,
          experimentStore: ExperimentStorePort,
          clock: ClockPort,
        },
        (operation, { deco, experimentStore, ...deps }) =>
          makePublishMerchantConfiguration(
            deco.administered(
              operation,
              new PublishMerchantConfigurationUseCase({ ...deps, experimentStore }),
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
          ),
      ),
      getMerchantConfiguration: handler(
        {
          deco: DecoratorsPort,
          scoped: ScopedMerchantPort,
          store: ConfigurationStorePort,
          configuration: ConfigurationServicePort,
        },
        (operation, { deco, ...deps }) =>
          makeGetMerchantConfiguration(deco.logged(operation, new GetMerchantConfigurationUseCase(deps))),
      ),
      listConfigurationVersions: handler(
        { deco: DecoratorsPort, scoped: ScopedMerchantPort, store: ConfigurationStorePort },
        (operation, { deco, ...deps }) =>
          makeListConfigurationVersions(deco.logged(operation, new ListConfigurationVersionsUseCase(deps))),
      ),
      getPlatformConfiguration: handler(
        { deco: DecoratorsPort, configuration: ConfigurationServicePort },
        (operation, { deco, ...deps }) =>
          makeGetPlatformConfiguration(deco.logged(operation, new GetPlatformConfigurationUseCase(deps))),
      ),
      getTreatmentDefaults: handler(
        { deco: DecoratorsPort, configuration: ConfigurationServicePort },
        (operation, { deco, ...deps }) =>
          makeGetTreatmentDefaults(deco.logged(operation, new GetTreatmentDefaultsUseCase(deps))),
      ),
    },
  },
});
