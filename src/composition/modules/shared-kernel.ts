// shared-kernel: the cross-cutting ports every module may need. It serves no operation, so it is
// not in MODULES; it only binds its ports.
import { pinoLogger } from "../../infrastructure/logging/pino-logger.js";
import { systemClock } from "../../interface-adapters/gateways/shared-kernel/system-clock.js";
import type { Clock, Logger } from "../../application/shared-kernel/index.js";
import type { Bindings } from "../wiring.js";

export interface SharedKernelPorts {
  clock: Clock;
  logger: Logger;
}

/** The system clock and pino to stdout; tests override the clock and the logger. */
export const localKernelPorts: Bindings<SharedKernelPorts> = {
  clock: () => systemClock,
  logger: () => pinoLogger(),
};
