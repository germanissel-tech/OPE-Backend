// How the register's queue is tuned (feature 031). Like the location of the store, these are values
// of the **environment** and not of behaviour, and this file exists to say why — because the plan of
// this feature said the opposite, and putting them in level 1 would have been a mistake with a
// visible consequence.
//
// Nothing a merchant or a visitor observes changes with them: the decision is the same (FR-007), what
// gets recorded is the same (FR-009, FR-011), and they are not part of the treatment that is frozen
// during the pilot (03 §4.10). What they tune is how much of an internal buffer is held before it is
// written, which describes the machine and not the product.
//
// And the consequence, which is what settled it: level 1 is **published to the SDK** inside
// `EffectiveConfiguration`, whose DTO is the whole record and whose schema admits no extra property.
// A queue size in level 1 would therefore have to be added to the contract — telling every merchant
// about the size of a buffer of ours — and this feature does not touch the contract.
import { whole } from "./env.js";
import type { Variable } from "./config-error.js";

const MAX_VARIABLE = "OPE_EVENT_LOG_MAX" satisfies Variable;
const INTERVAL_VARIABLE = "OPE_EVENT_LOG_FLUSH_MS" satisfies Variable;

/**
 * A development run buffers at most this many arrivals before it starts dropping them, and writes
 * every quarter of a second. Both are starting points, not measurements: the number that matters is
 * the one the latency test of this feature produces, and it is taken against SQLite on this machine
 * (**D-21**).
 */
const DEFAULT_MAX_ARRIVALS = 10_000;
const DEFAULT_FLUSH_INTERVAL_MS = 250;

export interface EventLogTuning {
  /** Arrivals held at most. Past it an arrival is dropped and said so, never awaited (FR-007). */
  readonly maxArrivals: number;
  /** How often what is pending is written. */
  readonly flushIntervalMs: number;
}

export function readEventLogTuning(env: NodeJS.ProcessEnv): EventLogTuning {
  return {
    maxArrivals: whole(env, MAX_VARIABLE, DEFAULT_MAX_ARRIVALS),
    flushIntervalMs: whole(env, INTERVAL_VARIABLE, DEFAULT_FLUSH_INTERVAL_MS),
  };
}
