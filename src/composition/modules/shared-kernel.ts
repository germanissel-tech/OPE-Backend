// shared-kernel: the cross-cutting ports every module may need. It serves no operation, so it is
// not in MODULES; it only binds its ports.
import { randomIds } from "../../interface-adapters/gateways/shared-kernel/random-ids.js";
import { systemClock } from "../../interface-adapters/gateways/shared-kernel/system-clock.js";
import type { Clock, IdGenerator } from "../../application/shared-kernel/index.js";
import type { Bindings } from "../wiring.js";

export interface SharedKernelPorts {
  clock: Clock;
  ids: IdGenerator;
}

/** The system clock and random identifiers: the only binding there is; tests override the clock. */
export const systemKernelPorts: Bindings<SharedKernelPorts> = {
  clock: () => systemClock,
  ids: () => randomIds,
};
