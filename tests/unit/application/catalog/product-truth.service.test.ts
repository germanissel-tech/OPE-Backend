// Feature 010, US2 (FR-005, FR-006; 01 §8; ADR-025): truth per class of datum, fail-closed with a reason.
// Feature 044, US4 (FR-006, FR-007; ADR-047): stock and price are the newest of the snapshot and the refresh of
// the variant, and their freshness is the variant's.
import { describe, expect, it } from "vitest";
import { ProductTruths, type CatalogStore } from "../../../../src/application/catalog/index.js";
import {
  asProductId,
  asVariantId,
  CatalogSnapshot,
  StockAndPrice,
  type Product,
  type VariantId,
} from "../../../../src/domain/catalog/index.js";
import { asMerchantId, Money, ok } from "../../../../src/domain/shared-kernel/index.js";
import { TEST_CATALOG_POLICIES } from "../../../helpers/platform.js";

const MIN = 60_000;
const HOUR = 60 * MIN;
const A = asMerchantId("m_a");
const captured = new Date("2026-09-18T12:00:00.000Z");
const at = (ms: number) => new Date(captured.getTime() + ms);
const P1 = asProductId("P1");
const V = asVariantId("P1-M");

const product: Product = {
  productId: P1,
  title: "Shirt",
  attributes: [{ key: "fit", value: "regular" }],
  variants: [
    {
      variantId: V,
      attributes: [
        { key: "size", value: "M" },
        { key: "color", value: "black" },
      ],
      available: false,
      price: Money.rehydrate({ amount: "10.00", currency: "ARS" }),
    },
  ],
};

function service(
  snapshot: CatalogSnapshot | undefined,
  now: Date,
  receipts: Date[] = [],
  refreshes: readonly StockAndPrice[] = [],
) {
  const kept = new Map<VariantId, StockAndPrice>(refreshes.map((r) => [r.variantId, r]));
  const store: CatalogStore = {
    current: () => Promise.resolve(snapshot),
    replace: () => Promise.resolve(ok(undefined)),
    refreshOf: (_m, variantId) => Promise.resolve(kept.get(variantId)),
    refresh: () => Promise.reject(new Error("the truth never refreshes")),
    receipts: () => Promise.resolve(receipts),
  };
  return new ProductTruths({
    clock: { now: () => now },
    store,
    policies: TEST_CATALOG_POLICIES,
  });
}
const snapshot = CatalogSnapshot.rehydrate({
  merchantId: A,
  capturedAt: captured,
  receivedAt: at(MIN),
  products: [product],
});

describe("freshness budget (01 §8; level 2 of the configuration)", () => {
  it("the defaults of the release: catalogue 36 h, stock and price 15 min", async () => {
    expect((await TEST_CATALOG_POLICIES.freshnessFor(A)).record()).toEqual({
      catalogMs: 36 * HOUR,
      stockAndPriceMs: 15 * MIN,
    });
  });
});

describe("ProductTruths.lookup", () => {
  it("5 minutes after the capture: known, catalogue and stock/price fresh, availability as recorded", async () => {
    const truth = await service(snapshot, at(5 * MIN)).lookup(A, P1, V);
    expect(truth).toMatchObject({
      kind: "known",
      stockAndPrice: "fresh",
      ageMs: 5 * MIN,
    });
    if (truth.kind === "known") {
      expect(truth.variant.available).toBe(false);
      expect(truth.product.attributes).toEqual([{ key: "fit", value: "regular" }]);
    }
  });

  it("2 hours after: known with stock/price stale (fit and attributes yes, availability and price no)", async () => {
    expect(await service(snapshot, at(2 * HOUR)).lookup(A, P1, V)).toMatchObject({
      kind: "known",
      stockAndPrice: "stale",
    });
    expect(await service(snapshot, at(15 * MIN)).lookup(A, P1, V)).toMatchObject({
      stockAndPrice: "fresh",
    });
    expect(await service(snapshot, at(15 * MIN + 1)).lookup(A, P1, V)).toMatchObject({
      stockAndPrice: "stale",
    });
  });

  it("3 days after: unknown, stale — nothing is true anymore", async () => {
    expect(await service(snapshot, at(3 * 24 * HOUR)).lookup(A, P1, V)).toEqual({
      kind: "unknown",
      reason: "stale",
    });
    expect(await service(snapshot, at(36 * HOUR)).lookup(A, P1, V)).toMatchObject({ kind: "known" });
    expect(await service(snapshot, at(36 * HOUR + 1)).lookup(A, P1, V)).toEqual({
      kind: "unknown",
      reason: "stale",
    });
  });

  it("no snapshot → absent; unknown product / variant → their reasons", async () => {
    expect(await service(undefined, at(0)).lookup(A, P1, V)).toEqual({ kind: "unknown", reason: "absent" });
    expect(await service(snapshot, at(0)).lookup(A, asProductId("P9"), V)).toEqual({
      kind: "unknown",
      reason: "unknown-product",
    });
    expect(await service(snapshot, at(0)).lookup(A, P1, asVariantId("P9-M"))).toEqual({
      kind: "unknown",
      reason: "unknown-variant",
    });
  });

  it("product without a variant in focus: known-product with the same freshness by class", async () => {
    const fresh = await service(snapshot, at(5 * MIN)).product(A, P1);
    expect(fresh).toMatchObject({
      kind: "known-product",
      stockAndPrice: "fresh",
    });
    expect(fresh.kind === "known-product" && fresh.product.productId).toBe(P1);
    const stale = await service(snapshot, at(2 * HOUR)).product(A, P1);
    expect(stale).toMatchObject({ kind: "known-product", stockAndPrice: "stale" });
    expect(await service(snapshot, at(3 * 24 * HOUR)).product(A, P1)).toEqual({
      kind: "unknown",
      reason: "stale",
    });
    expect(await service(undefined, at(0)).product(A, P1)).toEqual({ kind: "unknown", reason: "absent" });
    expect(await service(snapshot, at(0)).product(A, asProductId("P9"))).toEqual({
      kind: "unknown",
      reason: "unknown-product",
    });
  });

  it("syncLevel is the observed level of the receipts", async () => {
    expect(await service(snapshot, at(MIN), [at(0)]).syncLevel(A)).toBe(1);
    expect(await service(undefined, at(0)).syncLevel(A)).toBe(0);
  });
});

const refreshed = (observedAt: Date, available = true, amount = "12.00") =>
  StockAndPrice.rehydrate({ variantId: V, available, price: { amount, currency: "ARS" }, observedAt });

describe("ProductTruths with refreshes (feature 044, ADR-047)", () => {
  it("a newer refresh is the truth of the variant: its availability, its price and its age", async () => {
    const truth = await service(snapshot, at(2 * HOUR), [], [refreshed(at(2 * HOUR - 5 * MIN))]).lookup(
      A,
      P1,
      V,
    );
    expect(truth).toMatchObject({ kind: "known", stockAndPrice: "fresh", ageMs: 5 * MIN });
    if (truth.kind === "known") {
      expect(truth.variant.available).toBe(true);
      expect(truth.variant.price).toEqual({ amount: "12.00", currency: "ARS" });
      // What the refresh does not carry is the snapshot's.
      expect(truth.variant.attributes).toEqual(product.variants[0]?.attributes);
    }
  });

  it("the freshness is the variant's: the refresh ages on its own, at its own budget", async () => {
    const kept = [refreshed(at(HOUR))];
    expect(await service(snapshot, at(HOUR + 15 * MIN), [], kept).lookup(A, P1, V)).toMatchObject({
      stockAndPrice: "fresh",
    });
    expect(await service(snapshot, at(HOUR + 15 * MIN + 1), [], kept).lookup(A, P1, V)).toMatchObject({
      stockAndPrice: "stale",
      ageMs: 15 * MIN + 1,
    });
  });

  it("a refresh as old as the snapshot, or older, changes nothing: the variant ages with the snapshot", async () => {
    for (const observedAt of [captured, at(-MIN)]) {
      const truth = await service(snapshot, at(5 * MIN), [], [refreshed(observedAt)]).lookup(A, P1, V);
      expect(truth).toMatchObject({ kind: "known", stockAndPrice: "fresh", ageMs: 5 * MIN });
      if (truth.kind === "known") expect(truth.variant.available).toBe(false);
    }
  });

  it("the catalogue is still the snapshot's: a fresh refresh does not revive a stale catalogue", async () => {
    const kept = [refreshed(at(3 * 24 * HOUR - MIN))];
    expect(await service(snapshot, at(3 * 24 * HOUR), [], kept).lookup(A, P1, V)).toEqual({
      kind: "unknown",
      reason: "stale",
    });
  });

  it("the product without a variant in focus keeps the snapshot's freshness", async () => {
    const kept = [refreshed(at(2 * HOUR - MIN))];
    expect(await service(snapshot, at(2 * HOUR), [], kept).product(A, P1)).toMatchObject({
      kind: "known-product",
      stockAndPrice: "stale",
    });
  });
});
