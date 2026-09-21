// Observed synchronisation level (01 §14.1: the profile is measured, not declared; ADR-025).
// Derived on every question from the receipts and the age of the latest one, so it degrades by
// itself when the cadence breaks: 0 no data (or the latest is too old), 1 a daily dump, 2 updates
// within minutes, 3 never (it takes a notification per change). The thresholds are treatment
// defaults a merchant overrides (constitution XI); the median is the algorithm.
import { fail, ok, type Result } from "../shared-kernel/index.js";
import { InvalidSyncLevelRules } from "./errors.js";

export type SyncLevel = 0 | 1 | 2 | 3;
const NO_DATA: SyncLevel = 0;
const DAILY: SyncLevel = 1;
const MINUTES: SyncLevel = 2;

export interface SyncLevelRulesRecord {
  /** How many receipts a store keeps per merchant: enough for a median of intervals. */
  receiptsKept: number;
  /** Age of the latest receipt beyond which the level is 0. */
  noDataAfterMs: number;
  /** Age of the latest receipt beyond which the level cannot be 2. */
  minutesLevelMaxAgeMs: number;
  /** Median interval between receipts at or under which the level is 2. */
  minutesLevelMedianIntervalMs: number;
  /** The least receipts a cadence can be judged on (two intervals, three receipts). */
  minutesLevelMinReceipts: number;
}

const FIELDS = [
  "receiptsKept",
  "noDataAfterMs",
  "minutesLevelMaxAgeMs",
  "minutesLevelMedianIntervalMs",
  "minutesLevelMinReceipts",
] as const;

const HALF = 2;
/** Two receipts make one interval: the least a cadence can be judged on. */
const MIN_RECEIPTS = 2;

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / HALF);
  const upper = sorted[middle] ?? 0;
  if (sorted.length % HALF === 1) return upper;
  return ((sorted[middle - 1] ?? upper) + upper) / HALF;
}

export class SyncLevelRules {
  readonly receiptsKept: number;
  readonly noDataAfterMs: number;
  readonly minutesLevelMaxAgeMs: number;
  readonly minutesLevelMedianIntervalMs: number;
  readonly minutesLevelMinReceipts: number;

  private constructor(record: SyncLevelRulesRecord) {
    this.receiptsKept = record.receiptsKept;
    this.noDataAfterMs = record.noDataAfterMs;
    this.minutesLevelMaxAgeMs = record.minutesLevelMaxAgeMs;
    this.minutesLevelMedianIntervalMs = record.minutesLevelMedianIntervalMs;
    this.minutesLevelMinReceipts = record.minutesLevelMinReceipts;
  }

  /** Every threshold a positive integer; the receipts kept enough for the receipts judged. */
  static of(record: SyncLevelRulesRecord): Result<SyncLevelRules, InvalidSyncLevelRules> {
    for (const field of FIELDS) {
      if (!Number.isInteger(record[field]) || record[field] < 1)
        return fail(new InvalidSyncLevelRules(field));
    }
    if (record.minutesLevelMinReceipts < MIN_RECEIPTS) {
      return fail(new InvalidSyncLevelRules("minutesLevelMinReceipts"));
    }
    if (record.receiptsKept < record.minutesLevelMinReceipts)
      return fail(new InvalidSyncLevelRules("receiptsKept"));
    return ok(new SyncLevelRules(record));
  }

  static rehydrate(record: SyncLevelRulesRecord): SyncLevelRules {
    return new SyncLevelRules(record);
  }

  record(): SyncLevelRulesRecord {
    return {
      receiptsKept: this.receiptsKept,
      noDataAfterMs: this.noDataAfterMs,
      minutesLevelMaxAgeMs: this.minutesLevelMaxAgeMs,
      minutesLevelMedianIntervalMs: this.minutesLevelMedianIntervalMs,
      minutesLevelMinReceipts: this.minutesLevelMinReceipts,
    };
  }

  /**
   * @param receipts instants OPE received snapshots, oldest first
   * @param now the clock
   */
  observe(receipts: readonly Date[], now: Date): SyncLevel {
    const latest = receipts.at(-1);
    if (latest === undefined) return NO_DATA;
    const age = now.getTime() - latest.getTime();
    if (age >= this.noDataAfterMs) return NO_DATA;
    if (receipts.length < this.minutesLevelMinReceipts || age >= this.minutesLevelMaxAgeMs) return DAILY;
    const intervals = receipts
      .slice(1)
      .map((at, i) => at.getTime() - (receipts[i]?.getTime() ?? at.getTime()));
    return median(intervals) <= this.minutesLevelMedianIntervalMs ? MINUTES : DAILY;
  }
}
