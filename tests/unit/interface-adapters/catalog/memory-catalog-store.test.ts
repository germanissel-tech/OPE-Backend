// The in-memory catalogue store: one snapshot per merchant, receipts capped, nothing crosses.
import { describe, expect, it } from "vitest";
import { CatalogSnapshot } from "../../../../src/domain/catalog/index.js";
import { asMerchantId } from "../../../../src/domain/shared-kernel/index.js";
import { memoryCatalogStore } from "../../../../src/interface-adapters/catalog/gateways/memory-catalog-store.js";

const A = asMerchantId("m_a");
/** The receipts the store keeps, as the caller (the configuration of the merchant) asks. */
const RECEIPTS_KEPT = 8;
const B = asMerchantId("m_b");
const at = (ms: number) => new Date(new Date("2026-09-18T12:00:00.000Z").getTime() + ms);
const snapshot = (merchantId = A, receivedAt = at(0)) =>
  CatalogSnapshot.rehydrate({ merchantId, capturedAt: receivedAt, receivedAt, products: [] });

describe("memoryCatalogStore", () => {
  it("holds the current snapshot per merchant; another merchant sees nothing", async () => {
    const store = memoryCatalogStore();
    await store.replace(A, snapshot(), RECEIPTS_KEPT);
    expect(await store.current(A)).toBeDefined();
    expect(await store.current(B)).toBeUndefined();
    expect(await store.receipts(B)).toEqual([]);
  });

  it("keeps the last receipts only, oldest first", async () => {
    const store = memoryCatalogStore();
    for (let i = 0; i < RECEIPTS_KEPT + 3; i += 1) {
      await store.replace(A, snapshot(A, at(i * 1000)), RECEIPTS_KEPT);
    }
    const receipts = await store.receipts(A);
    expect(receipts).toHaveLength(RECEIPTS_KEPT);
    expect(receipts[0]).toEqual(at(3000));
    expect(receipts.at(-1)).toEqual(at((RECEIPTS_KEPT + 2) * 1000));
  });
});
