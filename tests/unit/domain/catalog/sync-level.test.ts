// Feature 010, US3 (FR-010; 01 §14.1; ADR-025): the observed level follows the cadence and degrades
// alone. The thresholds are the defaults of the release (feature 017, constitution XI).
import { describe, expect, it } from "vitest";
import { SyncLevelRules } from "../../../../src/domain/catalog/index.js";
import { testLevels } from "../../../helpers/test-app.js";

const rules = () => testLevels().defaults.values.syncLevel;
const observedSyncLevel = (receipts: readonly Date[], now: Date) => rules().observe(receipts, now);

const MIN = 60_000;
const HOUR = 60 * MIN;
const base = new Date("2026-09-18T00:00:00.000Z").getTime();
const at = (ms: number) => new Date(base + ms);
const every = (intervalMs: number, count: number, from = 0) =>
  Array.from({ length: count }, (_, i) => at(from + i * intervalMs));

describe("observedSyncLevel", () => {
  it("no receipts → 0", () => {
    expect(observedSyncLevel([], at(0))).toBe(0);
  });

  it("a single or a daily receipt → 1 while the latest is younger than 36 h", () => {
    expect(observedSyncLevel([at(0)], at(MIN))).toBe(1);
    const daily = every(24 * HOUR, 3);
    expect(observedSyncLevel(daily, at(2 * 24 * HOUR + HOUR))).toBe(1);
  });

  it("receipts every 5 minutes for an hour → 2", () => {
    const receipts = every(5 * MIN, 8, 0);
    expect(observedSyncLevel(receipts, at(7 * 5 * MIN + MIN))).toBe(2);
  });

  it("degrades alone: level 2 falls to 1 after an hour without receipts and to 0 after 36 h", () => {
    const receipts = every(5 * MIN, 8, 0);
    const last = 7 * 5 * MIN;
    expect(observedSyncLevel(receipts, at(last + 59 * MIN))).toBe(2);
    expect(observedSyncLevel(receipts, at(last + 6 * HOUR))).toBe(1);
    expect(observedSyncLevel(receipts, at(last + 36 * HOUR))).toBe(0);
    expect(observedSyncLevel(receipts, at(last + 48 * HOUR))).toBe(0);
  });

  it("the median of the intervals decides: one long gap among short ones still counts as minutes", () => {
    const receipts = [at(0), at(5 * MIN), at(10 * MIN), at(3 * HOUR), at(3 * HOUR + 5 * MIN)];
    expect(observedSyncLevel(receipts, at(3 * HOUR + 6 * MIN))).toBe(2);
    const sparse = [at(0), at(HOUR), at(2 * HOUR)];
    expect(observedSyncLevel(sparse, at(2 * HOUR + MIN))).toBe(1);
  });

  it("boundaries: a median of exactly 15 minutes (even count) is still minutes; exactly one hour of age is daily", () => {
    const receipts = [at(0), at(5 * MIN), at(30 * MIN)];
    expect(observedSyncLevel(receipts, at(31 * MIN))).toBe(2);
    expect(observedSyncLevel([at(0), at(5 * MIN), at(10 * MIN)], at(10 * MIN + HOUR - 1))).toBe(2);
    expect(observedSyncLevel([at(0), at(5 * MIN), at(10 * MIN)], at(10 * MIN + HOUR))).toBe(1);
    expect(observedSyncLevel([at(0), at(5 * MIN), at(31 * MIN)], at(32 * MIN))).toBe(1);
  });

  it("the median of an odd count is the middle interval: [10, 16, 20] minutes is 16, daily", () => {
    expect(observedSyncLevel([at(0), at(10 * MIN), at(26 * MIN), at(46 * MIN)], at(47 * MIN))).toBe(1);
  });

  it("two receipts are not a cadence: 1", () => {
    expect(observedSyncLevel([at(0), at(5 * MIN)], at(6 * MIN))).toBe(1);
  });

  it("never 3 with full snapshots", () => {
    expect(observedSyncLevel(every(MIN, 8), at(8 * MIN))).toBe(2);
  });
});

describe("SyncLevelRules.of", () => {
  it("every threshold a positive integer; the receipts kept cover the receipts judged; two receipts at least", () => {
    const record = rules().record();
    expect(SyncLevelRules.of(record).ok).toBe(true);
    const zero = SyncLevelRules.of({ ...record, noDataAfterMs: 0 });
    expect(zero.ok ? undefined : zero.error.details).toEqual({ path: "noDataAfterMs" });
    const fraction = SyncLevelRules.of({ ...record, receiptsKept: 2.5 });
    expect(fraction.ok ? undefined : fraction.error.details).toEqual({ path: "receiptsKept" });
    const one = SyncLevelRules.of({ ...record, minutesLevelMinReceipts: 1 });
    expect(one.ok ? undefined : one.error.details).toEqual({ path: "minutesLevelMinReceipts" });
    const fewer = SyncLevelRules.of({ ...record, receiptsKept: 2 });
    expect(fewer.ok ? undefined : fewer.error.details).toEqual({ path: "receiptsKept" });
    expect(SyncLevelRules.rehydrate(record).record()).toEqual(record);
  });
});
