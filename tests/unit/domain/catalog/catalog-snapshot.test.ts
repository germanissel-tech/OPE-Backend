// Feature 010, US1 (FR-002; ADR-007, ADR-025): the invariants of a snapshot, enforced by construction, and
// what a snapshot answers about its products and variants.
import { describe, expect, it } from "vitest";
import {
  asProductId,
  asVariantId,
  CatalogCapturedInFuture,
  CatalogDuplicateProductId,
  CatalogDuplicateVariantId,
  CatalogSnapshot,
  type Product,
} from "../../../../src/domain/catalog/index.js";
import { asMerchantId, CLOCK_SKEW_TOLERANCE_MS, Money } from "../../../../src/domain/shared-kernel/index.js";

const MIN = 60_000;
const receivedAt = new Date("2026-09-18T12:00:00.000Z");
const at = (offsetMs: number): Date => new Date(receivedAt.getTime() + offsetMs);
const A = asMerchantId("m_a");

const variant = (id: string, over: Partial<Product["variants"][number]> = {}) => ({
  variantId: asVariantId(id),
  size: "M",
  color: "black",
  available: true,
  price: Money.rehydrate({ amount: "19990.00", currency: "ARS" }),
  ...over,
});
const product = (id: string, variants = [variant(`${id}-M`)]): Product => ({
  productId: asProductId(id),
  title: `Product ${id}`,
  attributes: [{ key: "fit", value: "regular" }],
  variants,
});

describe("CatalogSnapshot.of", () => {
  it("a snapshot with unique ids and a capture within tolerance exists and answers about its content", () => {
    const built = CatalogSnapshot.of({
      merchantId: A,
      capturedAt: at(-MIN),
      receivedAt,
      products: [product("P1"), product("P2")],
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value.counts()).toEqual({ products: 2, variants: 2 });
    expect(built.value.product(asProductId("P1"))?.title).toBe("Product P1");
    expect(built.value.product(asProductId("P1"))?.variants.map((v) => v.size)).toEqual(["M"]);
    expect(built.value.product(asProductId("P9"))).toBeUndefined();
  });

  it("an empty snapshot is valid: no catalogue", () => {
    const built = CatalogSnapshot.of({ merchantId: A, capturedAt: receivedAt, receivedAt, products: [] });
    expect(built.ok && built.value.counts()).toEqual({ products: 0, variants: 0 });
  });

  it("[invariant:catalog-duplicate-product-id] two products with the same id → rejected", () => {
    const built = CatalogSnapshot.of({
      merchantId: A,
      capturedAt: receivedAt,
      receivedAt,
      products: [product("P1"), product("P1", [variant("P1-L")])],
    });
    expect(built).toMatchObject({
      ok: false,
      error: { code: "catalog-duplicate-product-id", module: "catalog" },
    });
    if (!built.ok) expect(built.error).toBeInstanceOf(CatalogDuplicateProductId);
  });

  it("[invariant:catalog-duplicate-variant-id] the same variant id in two products, or twice in one → rejected", () => {
    const across = CatalogSnapshot.of({
      merchantId: A,
      capturedAt: receivedAt,
      receivedAt,
      products: [product("P1", [variant("V")]), product("P2", [variant("V")])],
    });
    expect(across).toMatchObject({ ok: false, error: { code: "catalog-duplicate-variant-id" } });
    if (!across.ok) expect(across.error).toBeInstanceOf(CatalogDuplicateVariantId);
    const within = CatalogSnapshot.of({
      merchantId: A,
      capturedAt: receivedAt,
      receivedAt,
      products: [product("P1", [variant("V"), variant("V")])],
    });
    expect(within).toMatchObject({ ok: false, error: { code: "catalog-duplicate-variant-id" } });
  });

  it("[invariant:catalog-captured-in-future] a capture more than 5 minutes ahead of the receipt → rejected; exactly 5 is fine", () => {
    const future = CatalogSnapshot.of({
      merchantId: A,
      capturedAt: at(5 * MIN + 1),
      receivedAt,
      products: [],
    });
    expect(future).toMatchObject({ ok: false, error: { code: "catalog-captured-in-future" } });
    if (!future.ok) {
      expect(future.error).toBeInstanceOf(CatalogCapturedInFuture);
      // The tolerance travels in the details, not repeated in the message (015 F-022).
      expect(future.error.details).toEqual({ toleranceMs: CLOCK_SKEW_TOLERANCE_MS });
      expect(future.error.message).not.toMatch(/\d/);
    }
    expect(CLOCK_SKEW_TOLERANCE_MS).toBe(5 * MIN);
    expect(CatalogSnapshot.of({ merchantId: A, capturedAt: at(5 * MIN), receivedAt, products: [] }).ok).toBe(
      true,
    );
  });

  it("the first violated invariant wins: capture in the future before duplicates", () => {
    const built = CatalogSnapshot.of({
      merchantId: A,
      capturedAt: at(60 * MIN),
      receivedAt,
      products: [product("P1"), product("P1")],
    });
    expect(built).toMatchObject({ ok: false, error: { code: "catalog-captured-in-future" } });
  });
});

describe("CatalogSnapshot facts", () => {
  const snapshot = CatalogSnapshot.rehydrate({
    merchantId: A,
    capturedAt: at(-10 * MIN),
    receivedAt,
    products: [product("P1")],
  });

  it("ageAt measures from the capture and is never negative", () => {
    expect(snapshot.ageAt(receivedAt)).toBe(10 * MIN);
    expect(snapshot.ageAt(at(-20 * MIN))).toBe(0);
  });

  it("sameContentAs compares products, variants and prices, not instants", () => {
    const later = CatalogSnapshot.rehydrate({
      merchantId: A,
      capturedAt: receivedAt,
      receivedAt: at(MIN),
      products: [product("P1")],
    });
    const priced = CatalogSnapshot.rehydrate({
      merchantId: A,
      capturedAt: receivedAt,
      receivedAt,
      products: [
        product("P1", [variant("P1-M", { price: Money.rehydrate({ amount: "1.00", currency: "ARS" }) })]),
      ],
    });
    const unavailable = CatalogSnapshot.rehydrate({
      merchantId: A,
      capturedAt: receivedAt,
      receivedAt,
      products: [product("P1", [variant("P1-M", { available: false })])],
    });
    const attributed = CatalogSnapshot.rehydrate({
      merchantId: A,
      capturedAt: receivedAt,
      receivedAt,
      products: [{ ...product("P1"), attributes: [{ key: "fit", value: "slim" }] }],
    });
    expect(snapshot.sameContentAs(later)).toBe(true);
    expect(snapshot.sameContentAs(priced)).toBe(false);
    expect(snapshot.sameContentAs(unavailable)).toBe(false);
    expect(snapshot.sameContentAs(attributed)).toBe(false);
  });

  it("rehydrate does not re-judge: duplicated ids come back as recorded", () => {
    const odd = CatalogSnapshot.rehydrate({
      merchantId: A,
      capturedAt: receivedAt,
      receivedAt,
      products: [product("P1"), product("P1")],
    });
    expect(odd.products).toHaveLength(2);
  });
});
