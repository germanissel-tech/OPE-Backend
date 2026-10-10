// Feature 044 (ADR-047): the treatment values gain what governs the reading of the platform — the source,
// the confirmed order states, the pull cadence and the notice retry — merged over the defaults and judged
// with the rest, each offence at its field.
import { describe, expect, it } from "vitest";
import { TreatmentValues, type TreatmentValuesRecord } from "../../../../src/domain/configuration/index.js";
import { testLevels } from "../../../helpers/test-app.js";

const values = (): TreatmentValuesRecord => {
  const { version, ...rest } = testLevels().defaults.record();
  expect(version).toBe("defaults-seed");
  return rest;
};

const pointerOf = (record: TreatmentValuesRecord): unknown => {
  const judged = TreatmentValues.judge(record);
  return judged.ok ? undefined : judged.error.details["pointer"];
};

describe("the values of the platform port", () => {
  it("the defaults carry them, and a judged value answers them", () => {
    const judged = TreatmentValues.judge(values());
    expect(judged.ok).toBe(true);
    if (!judged.ok) return;
    expect(judged.value.platformSource).toBe(values().platformSource);
    expect(judged.value.syncCadence.record()).toEqual(values().syncCadence);
    expect(judged.value.noticeRetry.record()).toEqual(values().noticeRetry);
    expect(judged.value.orderConfirmation.states).toEqual(values().confirmedOrderStates);
    expect(judged.value.record()).toEqual(values());
  });

  it("each offence names its field", () => {
    const v = values();
    const cases: [Partial<TreatmentValuesRecord>, string][] = [
      [{ platformSource: "ftp" as never }, "platformSource"],
      [{ syncCadence: { ...v.syncCadence, ordersMs: 0 } }, "syncCadence.ordersMs"],
      [{ noticeRetry: { ...v.noticeRetry, maxAttempts: 0 } }, "noticeRetry.maxAttempts"],
      [{ confirmedOrderStates: ["paid", "paid"] }, "confirmedOrderStates[1]"],
    ];
    for (const [over, pointer] of cases) expect(pointerOf({ ...v, ...over }), pointer).toBe(pointer);
  });

  it("orders pulled or subscribed with no confirmed state is refused; pushed, it is not", () => {
    const v = values();
    for (const mode of ["pull", "subscribe"] as const) {
      const record = { ...v, syncStrategy: { ...v.syncStrategy, orders: mode }, confirmedOrderStates: [] };
      expect(pointerOf(record), mode).toBe("confirmedOrderStates");
      expect(pointerOf({ ...record, confirmedOrderStates: ["invoiced"] }), mode).toBeUndefined();
    }
    expect(pointerOf({ ...v, syncStrategy: { ...v.syncStrategy, returns: "pull" } })).toBeUndefined();
    expect(pointerOf({ ...v, confirmedOrderStates: [] })).toBeUndefined();
  });

  it("a merchant overrides them value by value", () => {
    const v = values();
    const resolved = TreatmentValues.resolve(v, {
      platformSource: "test",
      confirmedOrderStates: ["invoiced"],
      syncCadence: { ordersMs: 5_000 },
      noticeRetry: { maxAttempts: 3 },
      syncStrategy: { orders: "pull" },
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.value.platformSource).toBe("test");
    expect(resolved.value.orderConfirmation.confirms("invoiced")).toBe(true);
    expect(resolved.value.syncCadence.record()).toEqual({ ...v.syncCadence, ordersMs: 5_000 });
    expect(resolved.value.noticeRetry.record()).toEqual({ ...v.noticeRetry, maxAttempts: 3 });
  });
});
