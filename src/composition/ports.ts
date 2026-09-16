// Typed container of ports (ADR-013). A profile has to provide every field: adding a port here
// without providing it in a profile does not compile (FR-003).
import type { EventDedup } from "../application/ingestion/index.js";
import type { DecisionLedger, ExposureLedger } from "../application/ledger/index.js";
import type { MerchantDirectory } from "../application/merchant/index.js";
import type { Clock, IdGenerator } from "../application/shared-kernel/index.js";

export interface Ports {
  clock: Clock;
  ids: IdGenerator;
  merchants: MerchantDirectory;
  eventDedup: EventDedup;
  decisions: DecisionLedger;
  exposures: ExposureLedger;
}

/** A gateway may need to shut down (connections, timers). In memory there is nothing to close. */
export interface Closable {
  close(): Promise<void> | void;
}

export function isClosable(value: unknown): value is Closable {
  return typeof value === "object" && value !== null && "close" in value && typeof value.close === "function";
}
