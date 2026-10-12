// Feature 044, US4 (FR-006, FR-007; ADR-047): the refresh use case builds the refresh, hands it to the store with
// the receipts the merchant keeps, and reports what became of each item; and the in-memory store forgets only
// the refreshes a new snapshot supersedes.
import { describe, expect, it } from "vitest";
import { RefreshStockAndPriceUseCase } from "../../../../src/application/catalog/index.js";
import {
  asProductId,
  asVariantId,
  CatalogSnapshot,
  type StockAndPriceRecord,
} from "../../../../src/domain/catalog/index.js";
import { asMerchantId } from "../../../../src/domain/shared-kernel/index.js";
import { memoryCatalogStore } from "../../../../src/interface-adapters/catalog/index.js";
import { TEST_CATALOG_POLICIES, TEST_TOLERANCE } from "../../../helpers/platform.js";
import { recordingLogger, unavailableCatalogStore } from "../../../helpers/unavailable-ledgers.js";

const MIN = 60_000;
const A = asMerchantId("m_a");
const NOW = new Date("2026-09-18T12:00:00.000Z");
const at = (minutes: number) => new Date(NOW.getTime() + minutes * MIN);
const V1 = asVariantId("V1");
const V2 = asVariantId("V2");

const snapshotAt = (capturedAt: Date) =>
  CatalogSnapshot.rehydrate({
    merchantId: A,
    capturedAt,
    receivedAt: capturedAt,
    products: [
      {
        productId: asProductId("P1"),
        title: "Shirt",
        attributes: [],
        variants: [V1, V2].map((variantId) => ({
          variantId,
          attributes: [],
          available: true,
          price: { amount: "9.00", currency: "ARS" },
        })),
      },
    ],
  });

const item = (variantId: typeof V1, observedAt: Date): StockAndPriceRecord => ({
  variantId,
  available: false,
  price: { amount: "10.00", currency: "ARS" },
  observedAt,
});

function subject(store = memoryCatalogStore()) {
  const { logger, entries } = recordingLogger();
  const useCase = new RefreshStockAndPriceUseCase({
    clock: { now: () => NOW },
    tolerance: TEST_TOLERANCE,
    store,
    policies: TEST_CATALOG_POLICIES,
    logger,
  });
  return { useCase, store, entries };
}

describe("RefreshStockAndPriceUseCase", () => {
  it("answers what became of each item and logs how many of each, never the items", async () => {
    const { useCase, store, entries } = subject();
    await store.replace(A, snapshotAt(at(-60)), 10);
    const response = await useCase.execute({
      merchantId: A,
      items: [item(V1, at(-1)), item(asVariantId("V9"), at(-1))],
    });
    expect(response).toEqual({
      ok: true,
      value: { applied: [V1], repeated: [], superseded: [], unknown: ["V9"] },
    });
    expect(entries).toEqual([
      {
        level: "info",
        message: "stock and price refreshed",
        fields: { merchantId: A, applied: 1, repeated: 0, superseded: 0, unknown: 1 },
      },
    ]);
    expect(await store.receipts(A)).toEqual([at(-60), NOW]);
  });

  it("an invalid refresh is refused before the store sees it", async () => {
    const { useCase, store, entries } = subject();
    await store.replace(A, snapshotAt(at(-60)), 10);
    const response = await useCase.execute({ merchantId: A, items: [item(V1, at(-2)), item(V1, at(-1))] });
    expect(response.ok).toBe(false);
    if (!response.ok) expect(response.error.code).toBe("stock-and-price-duplicate-variant-id");
    expect(await store.refreshOf(A, V1)).toBeUndefined();
    expect(entries).toEqual([]);
  });

  it("a store that cannot keep it answers its failure, and nothing is logged as refreshed", async () => {
    const { useCase, entries } = subject(unavailableCatalogStore());
    const response = await useCase.execute({ merchantId: A, items: [item(V1, at(-1))] });
    expect(response.ok).toBe(false);
    if (!response.ok) expect(response.error.code).toBe("ledger-unavailable");
    expect(entries).toEqual([]);
  });
});

describe("memoryCatalogStore: a new snapshot forgets only what it supersedes", () => {
  it("keeps a refresh newer than the new capture, and forgets one observed at it or before", async () => {
    const store = memoryCatalogStore();
    await store.replace(A, snapshotAt(at(-60)), 10);
    await subject(store).useCase.execute({ merchantId: A, items: [item(V1, at(-10)), item(V2, at(-20))] });
    await store.replace(A, snapshotAt(at(-20)), 10);
    expect((await store.refreshOf(A, V1))?.observedAt).toEqual(at(-10));
    expect(await store.refreshOf(A, V2)).toBeUndefined();
  });
});
