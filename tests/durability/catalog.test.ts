// The catalogue across a restart. Losing it is not losing evidence — the platform publishes again
// — but between the restart and the next publication OPE has no truth of product, so it intervenes
// nowhere and nobody finds out until somebody looks. In a daily publication flow that is a day.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CatalogSnapshot,
  asProductId,
  asVariantId,
  type CatalogSnapshotRecord,
  type Product,
} from "../../src/domain/catalog/index.js";
import { Money, asMerchantId } from "../../src/domain/shared-kernel/index.js";
import { sqliteCatalogStore } from "../../src/interface-adapters/catalog/index.js";
import { restartableStore, type Restartable } from "./store-fixture.js";

const SKEW_MS = 5 * 60 * 1000;
const MERCHANT = asMerchantId("m-uno");
const OTHER = asMerchantId("m-dos");
const CAPTURED = new Date("2026-09-26T10:00:00.000Z");

/** Two receipts kept: enough to see the window move, small enough to see it prune. */
const KEPT = 2;

let fixture: Restartable;

beforeEach(() => {
  fixture = restartableStore();
});

afterEach(() => {
  fixture.dispose();
});

const store = (): ReturnType<typeof sqliteCatalogStore> =>
  sqliteCatalogStore({ store: fixture.store, logger: fixture.logger });

const productOf = (id: string): Product => ({
  productId: asProductId(id),
  title: `Product ${id}`,
  attributes: [{ key: "material", value: "linen" }],
  variants: [
    {
      variantId: asVariantId(`${id}-1`),
      available: true,
      price: Money.rehydrate({ amount: "100.00", currency: "ARS" }),
      attributes: [{ key: "size", value: "L" }],
    },
  ],
});

function snapshotOf(over: Partial<CatalogSnapshotRecord> = {}): CatalogSnapshot {
  const built = CatalogSnapshot.of(
    {
      merchantId: MERCHANT,
      capturedAt: CAPTURED,
      receivedAt: CAPTURED,
      products: [productOf("SKU-1")],
      ...over,
    },
    SKEW_MS,
  );
  if (!built.ok) throw new Error(built.error.message);
  return built.value;
}

describe("the catalogue across a restart", () => {
  it("answers the truth of a variant without being published again", async () => {
    expect(await store().replace(MERCHANT, snapshotOf(), KEPT)).toEqual({ ok: true, value: undefined });

    fixture.restart();

    const current = await store().current(MERCHANT);
    expect(current).toBeInstanceOf(CatalogSnapshot);
    // The product is found through the index the snapshot builds on construction, which is what
    // proves it was rehydrated and not just parsed.
    const product = current?.product(asProductId("SKU-1"));
    expect(product?.variants[0]?.variantId).toBe("SKU-1-1");
    expect(product?.variants[0]?.attributes).toEqual([{ key: "size", value: "L" }]);
    expect(current?.counts()).toEqual({ products: 1, variants: 1 });
  });

  it("keeps the freshness it had: the capture instant is an instant, not the string JSON made of it", async () => {
    await store().replace(MERCHANT, snapshotOf(), KEPT);

    fixture.restart();

    const current = await store().current(MERCHANT);
    expect(current?.capturedAt).toBeInstanceOf(Date);
    expect(current?.capturedAt.getTime()).toBe(CAPTURED.getTime());
    expect(current?.receivedAt).toBeInstanceOf(Date);
  });

  it("does not change the observed synchronisation level by restarting", async () => {
    const first = new Date(CAPTURED.getTime());
    const second = new Date(CAPTURED.getTime() + 60_000);
    await store().replace(MERCHANT, snapshotOf({ receivedAt: first }), KEPT);
    await store().replace(MERCHANT, snapshotOf({ receivedAt: second }), KEPT);
    const before = await store().receipts(MERCHANT);

    fixture.restart();

    expect(await store().receipts(MERCHANT)).toEqual(before);
    expect(before.map((d) => d.toISOString())).toEqual([first.toISOString(), second.toISOString()]);
  });

  it("keeps only the receipts the merchant's policy asks for, across the restart too", async () => {
    for (let i = 0; i < 4; i += 1) {
      await store().replace(
        MERCHANT,
        snapshotOf({ receivedAt: new Date(CAPTURED.getTime() + i * 1000) }),
        KEPT,
      );
    }

    fixture.restart();

    const receipts = await store().receipts(MERCHANT);
    expect(receipts).toHaveLength(KEPT);
    // The last two, oldest first: the window moved and the pruning survived the restart.
    expect(receipts.map((d) => d.toISOString())).toEqual([
      new Date(CAPTURED.getTime() + 2000).toISOString(),
      new Date(CAPTURED.getTime() + 3000).toISOString(),
    ]);
  });

  it("treats the same snapshot published again as a repetition and not a conflict", async () => {
    await store().replace(MERCHANT, snapshotOf(), KEPT);

    fixture.restart();

    // The store accepts it: whether it is a repetition is the use case's judgement, and what
    // matters here is that the snapshot it compares against is still there to compare with.
    expect(await store().replace(MERCHANT, snapshotOf(), KEPT)).toEqual({ ok: true, value: undefined });
    expect((await store().current(MERCHANT))?.capturedAt.getTime()).toBe(CAPTURED.getTime());
  });

  it("shows a merchant nothing of another one", async () => {
    await store().replace(MERCHANT, snapshotOf(), KEPT);

    fixture.restart();

    expect(await store().current(OTHER)).toBeUndefined();
    expect(await store().receipts(OTHER)).toEqual([]);
  });

  it("degrades to the ledger's failure channel when the store refuses", async () => {
    fixture.makeUnavailable();

    const result = await store().replace(MERCHANT, snapshotOf(), KEPT);

    expect(result.ok).toBe(false);
    expect(fixture.logged[0]?.fields["write"]).toBe("catalog");
  });
});
