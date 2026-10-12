// The catalogue across a restart. Losing it is not losing evidence — the platform publishes again
// — but between the restart and the next publication OPE has no truth of product, so it intervenes
// nowhere and nobody finds out until somebody looks. In a daily publication flow that is a day.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CatalogSnapshot,
  StockAndPriceRefresh,
  asProductId,
  asVariantId,
  type CatalogSnapshotRecord,
  type Product,
  type StockAndPriceRecord,
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
      price: { amount: "100.00", currency: "ARS" },
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

  it("brings a price back whole, and the rule of money applies to it where it is asked for (feature 037)", async () => {
    await store().replace(MERCHANT, snapshotOf(), KEPT);

    fixture.restart();

    const price = (await store().current(MERCHANT))?.product(asProductId("SKU-1"))?.variants[0]?.price;
    // Before this feature the type of that price said Money and the store gave back a plain object: a case
    // that only compared fields passed, and the first `equals` would have failed here and nowhere else.
    expect(price).toEqual({ amount: "100.00", currency: "ARS" });
    if (price === undefined) throw new Error("no price came back");
    expect(Money.rehydrate(price).equals(Money.rehydrate({ amount: "100.00", currency: "ARS" }))).toBe(true);
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

/** A refresh of the variant SKU-1-1 (feature 044), observed `minutes` after the capture. */
function refreshOf(minutes: number, over: Partial<StockAndPriceRecord> = {}, merchantId = MERCHANT) {
  const observedAt = new Date(CAPTURED.getTime() + minutes * 60_000);
  const built = StockAndPriceRefresh.of(
    {
      merchantId,
      receivedAt: observedAt,
      items: [
        {
          variantId: asVariantId("SKU-1-1"),
          available: false,
          price: { amount: "90.00", currency: "ARS" },
          observedAt,
          ...over,
        },
      ],
    },
    SKEW_MS,
  );
  if (!built.ok) throw new Error(built.error.message);
  return built.value;
}

describe("the refreshes of stock and price across a restart (feature 044)", () => {
  it("come back whole: the datum, its instant and its price", async () => {
    await store().replace(MERCHANT, snapshotOf(), KEPT);
    const applied = await store().refresh(refreshOf(5), KEPT);
    expect(applied).toEqual({
      ok: true,
      value: { applied: ["SKU-1-1"], repeated: [], superseded: [], unknown: [] },
    });

    fixture.restart();

    const kept = await store().refreshOf(MERCHANT, asVariantId("SKU-1-1"));
    expect(kept?.record()).toEqual(refreshOf(5).items[0]?.record());
    expect(kept?.observedAt).toBeInstanceOf(Date);
  });

  it("judge against what survived: the same one repeats, an older one loses, and the row never moves back", async () => {
    await store().replace(MERCHANT, snapshotOf(), KEPT);
    await store().refresh(refreshOf(5), KEPT);

    fixture.restart();

    expect(await store().refresh(refreshOf(5), KEPT)).toMatchObject({ value: { repeated: ["SKU-1-1"] } });
    expect(await store().refresh(refreshOf(4), KEPT)).toMatchObject({ value: { superseded: ["SKU-1-1"] } });
    expect(await store().refresh(refreshOf(5, { available: true }), KEPT)).toMatchObject({
      value: { superseded: ["SKU-1-1"] },
    });
    expect((await store().refreshOf(MERCHANT, asVariantId("SKU-1-1")))?.available).toBe(false);
    expect(await store().refresh(refreshOf(6, { available: true }), KEPT)).toMatchObject({
      value: { applied: ["SKU-1-1"] },
    });
    expect((await store().refreshOf(MERCHANT, asVariantId("SKU-1-1")))?.available).toBe(true);
  });

  it("a new snapshot forgets the refreshes it supersedes and keeps the newer ones", async () => {
    await store().replace(MERCHANT, snapshotOf(), KEPT);
    await store().refresh(refreshOf(5), KEPT);
    await store().replace(
      MERCHANT,
      snapshotOf({ capturedAt: new Date(CAPTURED.getTime() + 4 * 60_000) }),
      KEPT,
    );

    fixture.restart();

    expect(await store().refreshOf(MERCHANT, asVariantId("SKU-1-1"))).toBeDefined();
    await store().replace(
      MERCHANT,
      snapshotOf({ capturedAt: new Date(CAPTURED.getTime() + 5 * 60_000) }),
      KEPT,
    );
    expect(await store().refreshOf(MERCHANT, asVariantId("SKU-1-1"))).toBeUndefined();
  });

  it("are receipts of the level, pruned with the snapshots' (research R-05)", async () => {
    await store().replace(MERCHANT, snapshotOf(), KEPT);
    await store().refresh(refreshOf(5), KEPT);
    await store().refresh(refreshOf(6), KEPT);

    fixture.restart();

    expect((await store().receipts(MERCHANT)).map((d) => d.toISOString())).toEqual([
      "2026-09-26T10:05:00.000Z",
      "2026-09-26T10:06:00.000Z",
    ]);
  });

  it("without a snapshot nothing is kept and nothing is received", async () => {
    expect(await store().refresh(refreshOf(5), KEPT)).toMatchObject({ value: { unknown: ["SKU-1-1"] } });

    fixture.restart();

    expect(await store().refreshOf(MERCHANT, asVariantId("SKU-1-1"))).toBeUndefined();
    expect(await store().receipts(MERCHANT)).toEqual([]);
  });

  it("show a merchant nothing of another one, with the same variantId", async () => {
    await store().replace(MERCHANT, snapshotOf(), KEPT);
    await store().replace(OTHER, snapshotOf({ merchantId: OTHER }), KEPT);
    await store().refresh(refreshOf(5), KEPT);

    fixture.restart();

    expect(await store().refreshOf(OTHER, asVariantId("SKU-1-1"))).toBeUndefined();
    expect(await store().refresh(refreshOf(5, {}, OTHER), KEPT)).toMatchObject({
      value: { applied: ["SKU-1-1"] },
    });
  });

  it("degrade to the ledger's failure channel when the store refuses, keeping nothing", async () => {
    await store().replace(MERCHANT, snapshotOf(), KEPT);
    fixture.makeUnavailable();

    const result = await store().refresh(refreshOf(5), KEPT);

    expect(result.ok).toBe(false);
    expect(fixture.logged[0]?.fields["write"]).toBe("catalog");
  });
});
