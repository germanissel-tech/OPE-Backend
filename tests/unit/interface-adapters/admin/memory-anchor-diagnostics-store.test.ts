// Feature 017 — FR-023: the last report per key with a counter, bounded per merchant.
import { describe, expect, it } from "vitest";
import { asMerchantId } from "../../../../src/domain/shared-kernel/index.js";
import { memoryAnchorDiagnosticsStore } from "../../../../src/interface-adapters/admin/gateways/memory-anchor-diagnostics-store.js";

const A = asMerchantId("mrc_a");
const B = asMerchantId("mrc_b");
const at = (s: number) => new Date(s * 1000);

describe("memoryAnchorDiagnosticsStore", () => {
  it("the same key updates the instant and increments the counter; the list is most recent first", async () => {
    const store = memoryAnchorDiagnosticsStore(10);
    await store.upsert({ merchantId: A, anchor: "cta", pageType: "product", lastSeenAt: at(1) });
    await store.upsert({ merchantId: A, anchor: "price", pageType: "product", lastSeenAt: at(2) });
    await store.upsert({ merchantId: A, anchor: "cta", pageType: "product", lastSeenAt: at(3) });
    const { items } = await store.listOf(A, { limit: 10 });
    expect(items.map((d) => [d.anchor, d.count, d.lastSeenAt.getTime() / 1000])).toEqual([
      ["cta", 2, 3],
      ["price", 1, 2],
    ]);
  });

  it("the configuration version is part of the key; the cap drops the oldest; merchants are isolated", async () => {
    const store = memoryAnchorDiagnosticsStore(2);
    await store.upsert({
      merchantId: A,
      anchor: "cta",
      pageType: "product",
      configurationVersion: 1,
      lastSeenAt: at(1),
    });
    await store.upsert({
      merchantId: A,
      anchor: "cta",
      pageType: "product",
      configurationVersion: 2,
      lastSeenAt: at(2),
    });
    await store.upsert({ merchantId: A, anchor: "policies", pageType: "cart", lastSeenAt: at(3) });
    await store.upsert({ merchantId: B, anchor: "cta", pageType: "product", lastSeenAt: at(4) });
    const a = (await store.listOf(A, { limit: 10 })).items;
    expect(a.map((d) => [d.anchor, d.configurationVersion])).toEqual([
      ["policies", undefined],
      ["cta", 2],
    ]);
    expect((await store.listOf(B, { limit: 10 })).items).toHaveLength(1);
  });
});
