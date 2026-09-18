// Typed container of ports (ADR-013): the intersection of what every module declares it needs.
// A profile has to provide every field, so a port a module adds to its slice and no profile
// provides does not compile (FR-003).
import type { CatalogPorts } from "./modules/catalog.js";
import type { ExperimentPorts } from "./modules/experiment.js";
import type { IngestionPorts } from "./modules/ingestion.js";
import type { LedgerPorts } from "./modules/ledger.js";
import type { MerchantPorts } from "./modules/merchant.js";
import type { SharedKernelPorts } from "./modules/shared-kernel.js";
import type { SystemPorts } from "./modules/system.js";

export type Ports = SharedKernelPorts &
  SystemPorts &
  MerchantPorts &
  ExperimentPorts &
  IngestionPorts &
  LedgerPorts &
  CatalogPorts;

/** A gateway may need to shut down (connections, timers). In memory there is nothing to close. */
export interface Closable {
  close(): Promise<void> | void;
}

export function isClosable(value: unknown): value is Closable {
  return typeof value === "object" && value !== null && "close" in value && typeof value.close === "function";
}
