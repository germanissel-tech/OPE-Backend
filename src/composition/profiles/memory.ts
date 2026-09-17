// The in-memory deployment: tests, local development and every feature until real persistence
// arrives (006). One binding table per module; a module's override replaces its port before the
// gateway is built, and the kernel is bound first because dedup shares its clock.
import { memoryIngestionPorts } from "../modules/ingestion.js";
import { memoryLedgerPorts } from "../modules/ledger.js";
import { configMerchantPorts } from "../modules/merchant.js";
import { systemKernelPorts } from "../modules/shared-kernel.js";
import { binder, type Profile } from "../profile.js";

export const memoryProfile: Profile = (config, overrides) => {
  const { bind, closables } = binder(overrides);
  const kernel = bind(systemKernelPorts);
  const ports = {
    ...kernel,
    ...bind(configMerchantPorts(config.merchants)),
    ...bind(memoryIngestionPorts(kernel.clock)),
    ...bind(memoryLedgerPorts),
  };
  return { ports, closables };
};
