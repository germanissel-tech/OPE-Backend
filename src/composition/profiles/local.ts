// The local deployment: no external service. Ledgers and dedup in memory, merchants from
// configuration, the system clock and pino to stdout. Tests, `npm run dev` and every feature
// until the persistence feature of the map arrives. Not a profile for traffic: the ledgers in
// memory never prune (they stand in for the durable ledger of 01 §9). One binding table per
// module; an override replaces a port before its gateway is built, and the kernel is bound first
// because dedup shares its clock.
import { ruleBarrierPorts } from "../modules/barrier.js";
import { memoryCatalogPorts } from "../modules/catalog.js";
import { configDecisionPorts, memoryDecisionPorts } from "../modules/decision.js";
import { configExperimentPorts, memoryAssignmentPorts } from "../modules/experiment.js";
import { memoryIngestionPorts } from "../modules/ingestion.js";
import { memoryLedgerPorts } from "../modules/ledger.js";
import { configMerchantPorts } from "../modules/merchant.js";
import { memoryOutcomesPorts } from "../modules/outcomes.js";
import { systemKernelPorts } from "../modules/shared-kernel.js";
import { binder, type Profile } from "../profile.js";

export const localProfile: Profile = (config, overrides) => {
  const { bind, closables } = binder(overrides);
  const kernel = bind(systemKernelPorts);
  const ports = {
    ...kernel,
    ...bind(configMerchantPorts(config.merchants.map((m) => m.merchant))),
    ...bind(configExperimentPorts(config.merchants)),
    ...bind(memoryAssignmentPorts),
    ...bind(memoryIngestionPorts(kernel.clock)),
    ...bind(memoryLedgerPorts),
    ...bind(memoryCatalogPorts),
    ...bind(ruleBarrierPorts),
    ...bind(configDecisionPorts(config.merchants)),
    ...bind(memoryDecisionPorts(kernel.clock)),
    ...bind(memoryOutcomesPorts),
  };
  return { ports, closables };
};
