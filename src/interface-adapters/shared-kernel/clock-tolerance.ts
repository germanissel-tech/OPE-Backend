// The tolerance of declared instants (level 1 of the configuration, constitution XI): how far into
// the future a client's instant may sit from the clock, and how far into the past an event may be
// (late uploads). It takes **readers** of the values and not the configuration entity: the kernel of the
// ring knows no other module, and since feature 036 a level is read when it is used, so a published
// version counts without a restart.
import type { ClockTolerance } from "../../application/shared-kernel/index.js";

export function clockToleranceOf(skewMs: () => number, eventPastMs: () => number): ClockTolerance {
  return { skewMs, eventPastMs };
}
