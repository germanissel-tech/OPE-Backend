// US3 (FR-010; 01 §14.1; ADR-025): the observed level follows the cadence and degrades alone.
import { describe, expect, it } from "vitest";
import { observedSyncLevel } from "../../../../src/application/catalog/index.js";

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

  it("two receipts are not a cadence: 1", () => {
    expect(observedSyncLevel([at(0), at(5 * MIN)], at(6 * MIN))).toBe(1);
  });

  it("never 3 with full snapshots", () => {
    expect(observedSyncLevel(every(MIN, 8), at(8 * MIN))).toBe(2);
  });
});
