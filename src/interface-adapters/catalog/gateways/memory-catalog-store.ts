// In-memory catalogue store: one snapshot, its refreshes and the last receipts per merchant; nothing crosses.
import { ok, type MerchantId } from "../../../domain/shared-kernel/index.js";
import type { CatalogStore } from "../../../application/catalog/index.js";
import type { CatalogSnapshot, StockAndPrice, VariantId } from "../../../domain/catalog/index.js";

interface Held {
  snapshot: CatalogSnapshot;
  refreshes: Map<VariantId, StockAndPrice>;
  receipts: Date[];
}

export function memoryCatalogStore(): CatalogStore {
  const byMerchant = new Map<MerchantId, Held>();
  const received = (held: Held | undefined, at: Date, kept: number): Date[] =>
    [...(held?.receipts ?? []), at].slice(-kept);
  return {
    current: (merchantId) => Promise.resolve(byMerchant.get(merchantId)?.snapshot),
    replace: (merchantId, snapshot, receiptsKept) => {
      const held = byMerchant.get(merchantId);
      const refreshes = new Map(
        [...(held?.refreshes ?? [])].filter(
          ([, kept]) => kept.observedAt.getTime() > snapshot.capturedAt.getTime(),
        ),
      );
      byMerchant.set(merchantId, {
        snapshot,
        refreshes,
        receipts: received(held, snapshot.receivedAt, receiptsKept),
      });
      return Promise.resolve(ok(undefined));
    },
    refreshOf: (merchantId, variantId) =>
      Promise.resolve(byMerchant.get(merchantId)?.refreshes.get(variantId)),
    refresh: (refresh, receiptsKept) => {
      const held = byMerchant.get(refresh.merchantId);
      const judged = refresh.judgedAgainst(held?.snapshot, (variantId) => held?.refreshes.get(variantId));
      if (held !== undefined) {
        for (const item of judged.applied) held.refreshes.set(item.variantId, item);
        held.receipts = received(held, refresh.receivedAt, receiptsKept);
      }
      return Promise.resolve(ok(judged.outcomes));
    },
    receipts: (merchantId) => Promise.resolve([...(byMerchant.get(merchantId)?.receipts ?? [])]),
  };
}
