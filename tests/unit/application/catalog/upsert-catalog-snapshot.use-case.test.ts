// Feature 010, US1 (FR-003; ADR-020, ADR-025): replace, repeat, conflict and out-of-order, with a fake store.
import { describe, expect, it } from "vitest";
import {
  UpsertCatalogSnapshotUseCase,
  type CatalogStore,
} from "../../../../src/application/catalog/index.js";
import {
  asProductId,
  asVariantId,
  type Attribute,
  type CatalogSnapshot,
  type Product,
} from "../../../../src/domain/catalog/index.js";
import { LedgerUnavailable } from "../../../../src/domain/ledger/index.js";
import { asMerchantId, fail, Money, ok } from "../../../../src/domain/shared-kernel/index.js";
import { TEST_CATALOG_POLICIES, TEST_TOLERANCE } from "../../../helpers/platform.js";
import { recordingLogger } from "../../../helpers/unavailable-ledgers.js";

const MIN = 60_000;
const A = asMerchantId("m_a");
const T0 = new Date("2026-09-18T12:00:00.000Z");
const at = (ms: number) => new Date(T0.getTime() + ms);

const product = (id: string, amount = "10.00"): Product => ({
  productId: asProductId(id),
  title: id,
  attributes: [],
  variants: [
    {
      variantId: asVariantId(`${id}-M`),
      size: "M",
      color: "black",
      available: true,
      price: Money.rehydrate({ amount, currency: "ARS" }),
    },
  ],
});

function fakeStore(down = false): CatalogStore & { held: () => CatalogSnapshot | undefined } {
  let current: CatalogSnapshot | undefined;
  const receipts: Date[] = [];
  return {
    current: () => Promise.resolve(current),
    replace: (_m, snapshot) => {
      if (down) return Promise.resolve(fail(new LedgerUnavailable()));
      current = snapshot;
      receipts.push(snapshot.receivedAt);
      return Promise.resolve(ok(undefined));
    },
    receipts: () => Promise.resolve([...receipts]),
    held: () => current,
  };
}

function subject(nowAt: () => Date, down = false) {
  const store = fakeStore(down);
  const { logger, entries } = recordingLogger();
  /** The report of the vocabulary: what the use case handed over, and to prove it hands it over once. */
  const reported: { attributes: readonly Attribute[]; at: Date }[] = [];
  const useCase = new UpsertCatalogSnapshotUseCase({
    clock: { now: nowAt },
    tolerance: TEST_TOLERANCE,
    store,
    policies: TEST_CATALOG_POLICIES,
    labels: {
      record: (_m, attributes, when) => {
        reported.push({ attributes, at: when });
        return Promise.resolve();
      },
    },
    logger,
  });
  return { useCase, store, entries, reported };
}

describe("UpsertCatalogSnapshotUseCase", () => {
  it("the first snapshot is created: summary with counts, receipt and level 1", async () => {
    const { useCase, store } = subject(() => at(0));
    const result = await useCase.execute({
      merchantId: A,
      capturedAt: at(-MIN),
      products: [product("P1"), product("P2")],
    });
    expect(result).toEqual({
      ok: true,
      value: { products: 2, variants: 2, receivedAt: at(0), observedSyncLevel: 1, outcome: "created" },
    });
    expect(store.held()?.counts()).toEqual({ products: 2, variants: 2 });
  });

  it("the vocabulary of the catalogue is reported once it is the catalogue, with the instant it arrived (FR-020)", async () => {
    const { useCase, reported } = subject(() => at(0));
    const shirt = { ...product("P1"), attributes: [{ key: "material", value: "Frisa" }] };
    await useCase.execute({ merchantId: A, capturedAt: at(-MIN), products: [shirt, product("P2")] });
    // Flat and with its repetitions, so whoever reads it counts products; the instant is the
    // snapshot's, not a later now.
    expect(reported).toEqual([{ attributes: [{ key: "material", value: "Frisa" }], at: at(0) }]);
  });

  it("nothing is reported when nothing was replaced: not a repeat, not a conflict, not a store that is down", async () => {
    let now = at(0);
    const { useCase, reported } = subject(() => now);
    await useCase.execute({ merchantId: A, capturedAt: at(-MIN), products: [product("P1")] });
    expect(reported).toHaveLength(1);
    now = at(MIN);
    await useCase.execute({ merchantId: A, capturedAt: at(-MIN), products: [product("P1")] });
    await useCase.execute({ merchantId: A, capturedAt: at(-MIN), products: [product("P1", "99.00")] });
    await useCase.execute({ merchantId: A, capturedAt: at(-2 * MIN), products: [] });
    expect(reported).toHaveLength(1);
    const down = subject(() => at(0), true);
    await down.useCase.execute({ merchantId: A, capturedAt: at(-MIN), products: [product("P1")] });
    expect(down.reported).toEqual([]);
  });

  it("a newer capture replaces completely: products that no longer come disappear", async () => {
    let now = at(0);
    const { useCase, store } = subject(() => now);
    await useCase.execute({ merchantId: A, capturedAt: at(-MIN), products: [product("P1"), product("P2")] });
    now = at(5 * MIN);
    const result = await useCase.execute({
      merchantId: A,
      capturedAt: at(4 * MIN),
      products: [product("P2")],
    });
    expect(result).toMatchObject({ ok: true, value: { products: 1, outcome: "created" } });
    expect(store.held()?.product(asProductId("P1"))).toBeUndefined();
  });

  it("the same capture with the same content repeats: nothing replaced, previous receipt kept", async () => {
    let now = at(0);
    const { useCase, store } = subject(() => now);
    await useCase.execute({ merchantId: A, capturedAt: at(-MIN), products: [product("P1")] });
    now = at(MIN);
    const result = await useCase.execute({ merchantId: A, capturedAt: at(-MIN), products: [product("P1")] });
    expect(result).toMatchObject({
      ok: true,
      value: { products: 1, receivedAt: at(0), outcome: "repeated" },
    });
    expect(await store.receipts(A)).toHaveLength(1);
  });

  it("the same capture with different content → idempotency-conflict, current intact", async () => {
    const { useCase, store } = subject(() => at(0));
    await useCase.execute({ merchantId: A, capturedAt: at(-MIN), products: [product("P1")] });
    const result = await useCase.execute({
      merchantId: A,
      capturedAt: at(-MIN),
      products: [product("P1", "99.00")],
    });
    expect(result).toMatchObject({
      ok: false,
      error: { code: "idempotency-conflict", module: "shared-kernel" },
    });
    expect(store.held()?.product(asProductId("P1"))?.variants[0]?.price.amount).toBe("10.00");
  });

  it("[invariant:catalog-out-of-order] an older capture than the current one is rejected, current intact", async () => {
    const { useCase, store } = subject(() => at(0));
    await useCase.execute({ merchantId: A, capturedAt: at(-MIN), products: [product("P1")] });
    const result = await useCase.execute({ merchantId: A, capturedAt: at(-2 * MIN), products: [] });
    expect(result).toMatchObject({ ok: false, error: { code: "catalog-out-of-order", module: "catalog" } });
    if (!result.ok) expect(result.error.message).toContain(at(-MIN).toISOString());
    expect(store.held()?.counts().products).toBe(1);
  });

  it("an invariant of the snapshot itself is returned and nothing is stored", async () => {
    const { useCase, store } = subject(() => at(0));
    const result = await useCase.execute({
      merchantId: A,
      capturedAt: at(-MIN),
      products: [product("P1"), product("P1")],
    });
    expect(result).toMatchObject({ ok: false, error: { code: "catalog-duplicate-product-id" } });
    expect(store.held()).toBeUndefined();
  });

  it("the level rises to 2 with a cadence of minutes", async () => {
    let now = at(0);
    const { useCase } = subject(() => now);
    let last;
    for (let i = 0; i < 3; i += 1) {
      now = at(i * 5 * MIN);
      last = await useCase.execute({
        merchantId: A,
        capturedAt: at(i * 5 * MIN - MIN),
        products: [product("P1")],
      });
    }
    expect(last).toMatchObject({ ok: true, value: { observedSyncLevel: 2 } });
  });

  it("a store that cannot accept the snapshot → ledger-unavailable, and nothing is replaced (F-044, ADR-021)", async () => {
    const { useCase, store } = subject(() => at(0), true);
    const result = await useCase.execute({ merchantId: A, capturedAt: at(-MIN), products: [product("P1")] });
    expect(result).toMatchObject({ ok: false, error: { code: "ledger-unavailable", module: "ledger" } });
    if (!result.ok) expect(result.error).toBeInstanceOf(LedgerUnavailable);
    expect(store.held()).toBeUndefined();
  });
});
