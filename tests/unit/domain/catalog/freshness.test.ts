// Feature 017 — US2 (constitution XI; ADR-025): a freshness budget only exists valid — both
// budgets positive, stock and price never outliving the catalogue — and a refusal names its
// field both as the typed `path` and in the details of the problem.
import { describe, expect, it } from "vitest";
import { FreshnessBudget } from "../../../../src/domain/catalog/index.js";

describe("FreshnessBudget.of", () => {
  it("accepts positive budgets with stock and price within the catalogue and answers them back", () => {
    const built = FreshnessBudget.of({ catalogMs: 100, stockAndPriceMs: 100 });
    expect(built.ok ? built.value.record() : built.error).toEqual({ catalogMs: 100, stockAndPriceMs: 100 });
    expect(FreshnessBudget.rehydrate({ catalogMs: 5, stockAndPriceMs: 9 }).record()).toEqual({
      catalogMs: 5,
      stockAndPriceMs: 9,
    });
  });

  it("refuses a budget that is not a positive number, or stock and price above the catalogue, naming the field", () => {
    const cases: [{ catalogMs: number; stockAndPriceMs: number }, string][] = [
      [{ catalogMs: 0, stockAndPriceMs: 1 }, "catalogMs"],
      [{ catalogMs: Number.NaN, stockAndPriceMs: 1 }, "catalogMs"],
      [{ catalogMs: 10, stockAndPriceMs: -1 }, "stockAndPriceMs"],
      [{ catalogMs: 10, stockAndPriceMs: 11 }, "stockAndPriceMs"],
    ];
    for (const [record, path] of cases) {
      const built = FreshnessBudget.of(record);
      expect(built.ok ? undefined : built.error.path, path).toBe(path);
      expect(built.ok ? undefined : built.error.details, path).toEqual({ path });
      expect(built.ok ? undefined : built.error.code).toBe("invalid-freshness-budget");
    }
  });
});
