import type { Clock } from "../../application/shared-kernel/index.js";

/** System clock. Wired by the composition profile; tests inject a fixed one. */
export const systemClock: Clock = { now: () => new Date() };
