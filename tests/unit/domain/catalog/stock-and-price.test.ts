// Feature 044, US4 (FR-006, FR-007; ADR-047): a refresh of stock and price is a layer over the snapshot. Its
// invariants are enforced by construction, each item is judged against what the variant already holds, and the
// truth of a variant is the newest of the snapshot and its refresh.
import { describe, expect, it } from "vitest";
import {
  asProductId,
  asVariantId,
  CatalogSnapshot,
  StockAndPrice,
  StockAndPriceRefresh,
  type StockAndPriceRecord,
  type VariantId,
} from "../../../../src/domain/catalog/index.js";
import { asMerchantId, minutes } from "../../../../src/domain/shared-kernel/index.js";

const MIN = 60_000;
const SKEW_MS = minutes(5);
const receivedAt = new Date("2026-09-18T12:00:00.000Z");
const at = (offsetMs: number): Date => new Date(receivedAt.getTime() + offsetMs);
const A = asMerchantId("m_a");
const V1 = asVariantId("V1");
const V2 = asVariantId("V2");
const V9 = asVariantId("V9");

const item = (
  variantId: VariantId,
  observedAt: Date,
  over: Partial<StockAndPriceRecord> = {},
): StockAndPriceRecord => ({
  variantId,
  available: true,
  price: { amount: "10.00", currency: "ARS" },
  observedAt,
  ...over,
});

const refresh = (...items: StockAndPriceRecord[]) =>
  StockAndPriceRefresh.of({ merchantId: A, receivedAt, items }, SKEW_MS);

const valid = (...items: StockAndPriceRecord[]): StockAndPriceRefresh => {
  const built = refresh(...items);
  if (!built.ok) throw new Error("the refresh is valid");
  return built.value;
};

const snapshot = CatalogSnapshot.rehydrate({
  merchantId: A,
  capturedAt: at(-60 * MIN),
  receivedAt: at(-59 * MIN),
  products: [
    {
      productId: asProductId("P1"),
      title: "Shirt",
      attributes: [],
      variants: [
        { variantId: V1, attributes: [], available: false, price: { amount: "9.00", currency: "ARS" } },
        { variantId: V2, attributes: [], available: true, price: { amount: "9.00", currency: "ARS" } },
      ],
    },
  ],
});

describe("StockAndPriceRefresh.of", () => {
  it("accepts unique variants observed up to the tolerance ahead of the clock", () => {
    const built = refresh(item(V1, at(-MIN)), item(V2, at(SKEW_MS)));
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(built.value.items.map((i) => i.record())).toEqual([item(V1, at(-MIN)), item(V2, at(SKEW_MS))]);
      expect(built.value.items[0]).toBeInstanceOf(StockAndPrice);
      expect(built.value.merchantId).toBe(A);
      expect(built.value.receivedAt).toEqual(receivedAt);
    }
  });

  it("[invariant:stock-and-price-duplicate-variant-id] the same variant twice is refused, naming it", () => {
    const built = refresh(item(V1, at(-2 * MIN)), item(V2, at(-MIN)), item(V1, at(-MIN)));
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(built.error.code).toBe("stock-and-price-duplicate-variant-id");
      expect(built.error.details).toEqual({ variantId: "V1" });
      expect(built.error.message).toContain("V1");
    }
  });

  it("[invariant:stock-captured-in-future] an item observed beyond the tolerance is refused, naming it", () => {
    const built = refresh(item(V1, at(-MIN)), item(V2, at(SKEW_MS + 1)));
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(built.error.code).toBe("stock-captured-in-future");
      expect(built.error.details).toEqual({ variantId: "V2", toleranceMs: SKEW_MS });
    }
  });
});

describe("StockAndPrice.against: what a datum does to its variant", () => {
  const capturedAt = at(-60 * MIN);
  const datum = (observedAt: Date, over: Partial<StockAndPriceRecord> = {}) =>
    StockAndPrice.rehydrate(item(V1, observedAt, over));

  it("newer than the snapshot and nothing kept: applied", () => {
    expect(datum(at(-MIN)).against(undefined, capturedAt)).toBe("applied");
  });

  it("as old as the snapshot, or older: superseded, because the snapshot already said what was true then", () => {
    expect(datum(capturedAt).against(undefined, capturedAt)).toBe("superseded");
    expect(datum(at(-61 * MIN)).against(undefined, capturedAt)).toBe("superseded");
  });

  it("against the refresh kept: newer applies, older loses", () => {
    const kept = datum(at(-10 * MIN));
    expect(datum(at(-10 * MIN + 1)).against(kept, capturedAt)).toBe("applied");
    expect(datum(at(-10 * MIN - 1)).against(kept, capturedAt)).toBe("superseded");
  });

  it("the same instant: a repetition with the same content, and the one kept stays with another", () => {
    const kept = datum(at(-10 * MIN));
    expect(datum(at(-10 * MIN)).against(kept, capturedAt)).toBe("repeated");
    expect(datum(at(-10 * MIN), { available: false }).against(kept, capturedAt)).toBe("superseded");
    const otherAmount = datum(at(-10 * MIN), { price: { amount: "11.00", currency: "ARS" } });
    expect(otherAmount.against(kept, capturedAt)).toBe("superseded");
    const otherCurrency = datum(at(-10 * MIN), { price: { amount: "10.00", currency: "USD" } });
    expect(otherCurrency.against(kept, capturedAt)).toBe("superseded");
  });
});

describe("StockAndPriceRefresh.judgedAgainst", () => {
  it("sorts every item into its outcome and applies only what became the truth", () => {
    const kept = new Map([[V2, StockAndPrice.rehydrate(item(V2, at(-5 * MIN)))]]);
    const judged = valid(item(V1, at(-MIN)), item(V2, at(-5 * MIN)), item(V9, at(-MIN))).judgedAgainst(
      snapshot,
      (v) => kept.get(v),
    );
    expect(judged.outcomes).toEqual({ applied: [V1], repeated: [V2], superseded: [], unknown: [V9] });
    expect(judged.applied.map((i) => i.variantId)).toEqual([V1]);
  });

  it("an older datum than the kept one is superseded and not applied", () => {
    const kept = new Map([[V1, StockAndPrice.rehydrate(item(V1, at(-MIN)))]]);
    const judged = valid(item(V1, at(-2 * MIN))).judgedAgainst(snapshot, (v) => kept.get(v));
    expect(judged.outcomes).toEqual({ applied: [], repeated: [], superseded: [V1], unknown: [] });
    expect(judged.applied).toEqual([]);
  });

  it("with no snapshot every variant is unknown: there is nothing to be a layer over", () => {
    expect(valid(item(V1, at(-MIN)), item(V2, at(-MIN))).judgedAgainst(undefined, () => undefined)).toEqual({
      outcomes: { applied: [], repeated: [], superseded: [], unknown: [V1, V2] },
      applied: [],
    });
  });
});

describe("CatalogSnapshot: the variants it has and the newest datum of each", () => {
  const variant = snapshot.products[0]?.variants[0];
  if (variant === undefined) throw new Error("the snapshot has V1");

  it("hasVariant answers for the variants of the picture only", () => {
    expect(snapshot.hasVariant(V1)).toBe(true);
    expect(snapshot.hasVariant(V9)).toBe(false);
    expect(snapshot.counts()).toEqual({ products: 1, variants: 2 });
  });

  it("without a refresh, or with one not newer than the picture, the truth is the picture's", () => {
    expect(snapshot.stockAndPriceOf(variant, undefined)).toEqual({ variant, at: snapshot.capturedAt });
    const asOld = StockAndPrice.rehydrate(item(V1, snapshot.capturedAt));
    expect(snapshot.stockAndPriceOf(variant, asOld)).toEqual({ variant, at: snapshot.capturedAt });
  });

  it("a newer refresh brings its availability, its price and its instant; the rest stays", () => {
    const newer = StockAndPrice.rehydrate(
      item(V1, at(-MIN), { price: { amount: "12.00", currency: "ARS" } }),
    );
    expect(snapshot.stockAndPriceOf(variant, newer)).toEqual({
      variant: { ...variant, available: true, price: { amount: "12.00", currency: "ARS" } },
      at: at(-MIN),
    });
  });
});
