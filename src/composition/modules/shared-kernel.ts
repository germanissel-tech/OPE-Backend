// shared-kernel: the cross-cutting ports every module may need. It serves no operation, so it is
// not in MODULES; it only binds its ports.
import { pinoLogger } from "../../infrastructure/logging/pino-logger.js";
import { systemClock } from "../../interface-adapters/gateways/shared-kernel/system-clock.js";
import type { Clock, ClockTolerance, Logger } from "../../application/shared-kernel/index.js";
import type { PlatformConfiguration } from "../../domain/configuration/index.js";
import type { Bindings } from "../wiring.js";

export interface SharedKernelPorts {
  clock: Clock;
  logger: Logger;
  /** How far an instant a client declares may sit from the clock (level 1 of the configuration). */
  tolerance: ClockTolerance;
}

/** The system clock, pino to stdout and the tolerance the release declares; tests override the clock and the logger. */
export const localKernelPorts = (platform: PlatformConfiguration): Bindings<SharedKernelPorts> => ({
  clock: () => systemClock,
  logger: () => pinoLogger(),
  tolerance: () => ({
    skewMs: () => platform.clockSkewToleranceMs,
    eventPastMs: () => platform.eventPastToleranceMs,
  }),
});
