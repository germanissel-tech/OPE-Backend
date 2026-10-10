// Feature 044 (ADR-047; constitution XI): the values that govern how OPE reads a merchant's platform only
// exist valid, and each offence names its field.
import { describe, expect, it } from "vitest";
import {
  NoticeRetry,
  OrderConfirmation,
  SyncCadence,
  type SyncCadenceRecord,
} from "../../../../src/domain/platform/index.js";

const cadence = (): SyncCadenceRecord => ({
  catalogMs: 86_400_000,
  stockAndPriceMs: 60_000,
  stockAndPriceBatchSize: 200,
  ordersMs: 120_000,
  returnsMs: 900_000,
});

describe("SyncCadence.of", () => {
  it("accepts positive integers and answers them back", () => {
    const built = SyncCadence.of(cadence());
    expect(built.ok ? built.value.record() : undefined).toEqual(cadence());
    expect(SyncCadence.rehydrate(cadence()).record()).toEqual(cadence());
  });

  it("refuses zero, a fraction or a negative, naming the field", () => {
    const fields = Object.keys(cadence()) as (keyof SyncCadenceRecord)[];
    for (const field of fields) {
      for (const bad of [0, 1.5, -1]) {
        const built = SyncCadence.of({ ...cadence(), [field]: bad });
        expect(built.ok ? undefined : built.error.path, `${field}=${bad}`).toBe(field);
        expect(built.ok ? undefined : built.error.details).toEqual({ path: field });
      }
    }
  });

  it("one is inside", () => {
    expect(SyncCadence.of({ ...cadence(), stockAndPriceBatchSize: 1, ordersMs: 1 }).ok).toBe(true);
  });
});

describe("NoticeRetry.of", () => {
  it("accepts positive integers and refuses the rest, naming the field", () => {
    const built = NoticeRetry.of({ afterMs: 1, maxAttempts: 1 });
    expect(built.ok ? built.value.record() : undefined).toEqual({ afterMs: 1, maxAttempts: 1 });
    expect(NoticeRetry.rehydrate({ afterMs: 5, maxAttempts: 2 }).record()).toEqual({
      afterMs: 5,
      maxAttempts: 2,
    });
    for (const [record, field] of [
      [{ afterMs: 0, maxAttempts: 3 }, "afterMs"],
      [{ afterMs: 10, maxAttempts: 0 }, "maxAttempts"],
      [{ afterMs: 10, maxAttempts: 2.5 }, "maxAttempts"],
    ] as const) {
      const refused = NoticeRetry.of(record);
      expect(refused.ok ? undefined : refused.error.path).toBe(field);
      expect(refused.ok ? undefined : refused.error.details).toEqual({ path: field });
    }
  });
});

describe("OrderConfirmation", () => {
  it("confirms exactly the states it names", () => {
    const built = OrderConfirmation.of(["invoiced", "ready-for-handling"]);
    const rule = built.ok ? built.value : OrderConfirmation.rehydrate([]);
    expect(rule.confirms("invoiced")).toBe(true);
    expect(rule.confirms("Invoiced")).toBe(false);
    expect(rule.confirms("canceled")).toBe(false);
    expect(rule.acceptsNone()).toBe(false);
    expect(rule.states).toEqual(["invoiced", "ready-for-handling"]);
  });

  it("an empty list accepts nothing", () => {
    const built = OrderConfirmation.of([]);
    expect(built.ok && built.value.acceptsNone()).toBe(true);
    expect(OrderConfirmation.rehydrate([]).confirms("")).toBe(false);
  });

  it("refuses a blank or a repeated state at its index", () => {
    const blank = OrderConfirmation.of(["paid", "  "]);
    expect(blank.ok ? undefined : blank.error.path).toBe("[1]");
    expect(blank.ok ? undefined : blank.error.details).toEqual({ path: "[1]" });
    const repeated = OrderConfirmation.of(["paid", "invoiced", "paid"]);
    expect(repeated.ok ? undefined : repeated.error.path).toBe("[2]");
  });
});
