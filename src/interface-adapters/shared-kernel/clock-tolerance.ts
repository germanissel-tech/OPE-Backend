// The tolerance of declared instants (level 1 of the configuration, constitution XI): how far into
// the future a client's instant may sit from the clock, and how far into the past an event may be
// (late uploads). It takes the values, not the configuration entity: the kernel of the ring knows
// no other module.
import type { ClockTolerance } from "../../application/shared-kernel/index.js";

export function clockToleranceOf(skewMs: number, eventPastMs: number): ClockTolerance {
  return { skewMs: () => skewMs, eventPastMs: () => eventPastMs };
}
