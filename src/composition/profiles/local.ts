// The local deployment: no external service. Ledgers and dedup in memory, merchants from
// configuration, the system clock and pino to stdout. Tests, `npm run dev` and every feature
// until real persistence arrives (006). One binding table per module; an override replaces a
// port before its gateway is built, and the kernel is bound first because dedup shares its clock.
import { memoryCatalogPorts } from "../modules/catalog.js";
import { configExperimentPorts, memoryAssignmentPorts } from "../modules/experiment.js";
import { memoryIngestionPorts } from "../modules/ingestion.js";
import { memoryLedgerPorts } from "../modules/ledger.js";
import { configMerchantPorts } from "../modules/merchant.js";
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
  };
  return { ports, closables };
};
