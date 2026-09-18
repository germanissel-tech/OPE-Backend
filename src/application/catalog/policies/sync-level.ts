// Observed synchronisation level (01 §14.1: the profile is measured, not declared; ADR-025).
// Derived on every question from the receipts and the age of the latest one, so it degrades
// by itself when the cadence breaks: 0 no data (or the latest is a day and a half old), 1 a
// daily dump, 2 updates within minutes, 3 never (it takes a notification per change).
import { hours, minutes } from "../../../domain/shared-kernel/index.js";

export type SyncLevel = 0 | 1 | 2 | 3;
const NO_DATA: SyncLevel = 0;
const DAILY: SyncLevel = 1;
const MINUTES: SyncLevel = 2;

/** How many receipts a store keeps per merchant: enough for a median of intervals. */
export const RECEIPTS_KEPT = 8;

const NO_DATA_AFTER_HOURS = 36;
const MINUTES_LEVEL_MAX_AGE_HOURS = 1;
const MINUTES_LEVEL_MEDIAN_INTERVAL_MINUTES = 15;
/** Two intervals, three receipts: the least a cadence can be judged on. */
const MINUTES_LEVEL_MIN_RECEIPTS = 3;

const NO_DATA_AFTER_MS = hours(NO_DATA_AFTER_HOURS);
const MINUTES_LEVEL_MAX_AGE_MS = hours(MINUTES_LEVEL_MAX_AGE_HOURS);
const MINUTES_LEVEL_MEDIAN_INTERVAL_MS = minutes(MINUTES_LEVEL_MEDIAN_INTERVAL_MINUTES);

const HALF = 2;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / HALF);
  const upper = sorted[middle] ?? 0;
  if (sorted.length % HALF === 1) return upper;
  return ((sorted[middle - 1] ?? upper) + upper) / HALF;
}

/**
 * @param receipts instants OPE received snapshots, oldest first
 * @param now the clock
 */
export function observedSyncLevel(receipts: readonly Date[], now: Date): SyncLevel {
  const latest = receipts.at(-1);
  if (latest === undefined) return NO_DATA;
  const age = now.getTime() - latest.getTime();
  if (age >= NO_DATA_AFTER_MS) return NO_DATA;
  if (receipts.length < MINUTES_LEVEL_MIN_RECEIPTS || age >= MINUTES_LEVEL_MAX_AGE_MS) return DAILY;
  const intervals = receipts.slice(1).map((at, i) => at.getTime() - (receipts[i]?.getTime() ?? at.getTime()));
  return median(intervals) <= MINUTES_LEVEL_MEDIAN_INTERVAL_MS ? MINUTES : DAILY;
}
