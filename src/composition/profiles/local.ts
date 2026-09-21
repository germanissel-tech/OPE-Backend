// The local deployment: no external service. Ledgers and dedup in memory, merchants from
// configuration, the system clock and pino to stdout. Tests, `npm run dev` and every feature
// until the persistence feature of the map arrives. Not a profile for traffic: the ledgers in
// memory never prune (they stand in for the durable ledger of 01 §9). One binding table per
// module; an override replaces a port before its gateway is built, and the kernel is bound first
// because dedup shares its clock.
import { configAdminPorts, memoryAdminPorts } from "../modules/admin.js";
import { ruleBarrierPorts } from "../modules/barrier.js";
import { configuredCatalogPorts, memoryCatalogPorts } from "../modules/catalog.js";
import { memoryConfigurationPorts } from "../modules/configuration.js";
import { configuredDecisionPorts, memoryDecisionPorts } from "../modules/decision.js";
import { configuredExperimentPorts, memoryExperimentPorts } from "../modules/experiment.js";
import { memoryIngestionPorts } from "../modules/ingestion.js";
import { memoryLedgerPorts } from "../modules/ledger.js";
import { memoryMerchantPorts } from "../modules/merchant.js";
import { memoryOutcomesPorts } from "../modules/outcomes.js";
import { localKernelPorts } from "../modules/shared-kernel.js";
import { binder, type Profile } from "../profile.js";

export const localProfile: Profile = (config, overrides) => {
  const { bind, closables } = binder(overrides);
  const { platform } = config.levels;
  const kernel = bind(localKernelPorts(platform));
  const merchant = bind(memoryMerchantPorts(platform));
  const configuration = bind(memoryConfigurationPorts(config.levels));
  const ports = {
    ...kernel,
    ...merchant,
    ...configuration,
    ...bind(memoryExperimentPorts()),
    ...bind(configuredExperimentPorts(() => configuration.configuration)),
    ...bind(memoryIngestionPorts(kernel.clock, platform)),
    ...bind(memoryLedgerPorts),
    ...bind(memoryCatalogPorts),
    ...bind(configuredCatalogPorts(() => configuration.configuration)),
    ...bind(ruleBarrierPorts),
    ...bind(
      configuredDecisionPorts(
        () => configuration.configuration,
        () => merchant.merchantStore,
      ),
    ),
    ...bind(memoryDecisionPorts(kernel.clock, platform)),
    ...bind(memoryOutcomesPorts),
    ...bind(configAdminPorts(config.operators)),
    ...bind(memoryAdminPorts(platform)),
  };
  return { ports, closables };
};
