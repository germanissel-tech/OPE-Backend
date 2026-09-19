// US1 (FR-003; ADR-020, ADR-025): replace, repeat, conflict and out-of-order, with a fake store.
import { describe, expect, it } from "vitest";
import {
  UpsertCatalogSnapshotUseCase,
  type CatalogStore,
} from "../../../../src/application/catalog/index.js";
import {
  asProductId,
  asVariantId,
  type CatalogSnapshot,
  type Product,
} from "../../../../src/domain/catalog/index.js";
import { LedgerUnavailable } from "../../../../src/domain/ledger/index.js";
import { asMerchantId, fail, Money, ok } from "../../../../src/domain/shared-kernel/index.js";
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
  const useCase = new UpsertCatalogSnapshotUseCase({ clock: { now: nowAt }, store, logger });
  return { useCase, store, entries };
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
    expect(store.held()?.variant(asProductId("P1"), asVariantId("P1-M"))?.variant.price.amount).toBe("10.00");
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
