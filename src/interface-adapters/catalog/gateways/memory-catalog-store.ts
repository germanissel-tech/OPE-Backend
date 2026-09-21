// In-memory catalogue store: one snapshot and the last receipts per merchant; nothing crosses.
import { ok, type MerchantId } from "../../../domain/shared-kernel/index.js";
import type { CatalogStore } from "../../../application/catalog/index.js";
import type { CatalogSnapshot } from "../../../domain/catalog/index.js";

interface Held {
  snapshot: CatalogSnapshot;
  receipts: Date[];
}

export function memoryCatalogStore(): CatalogStore {
  const byMerchant = new Map<MerchantId, Held>();
  return {
    current: (merchantId) => Promise.resolve(byMerchant.get(merchantId)?.snapshot),
    replace: (merchantId, snapshot, receiptsKept) => {
      const held = byMerchant.get(merchantId);
      const receipts = [...(held?.receipts ?? []), snapshot.receivedAt].slice(-receiptsKept);
      byMerchant.set(merchantId, { snapshot, receipts });
      return Promise.resolve(ok(undefined));
    },
    receipts: (merchantId) => Promise.resolve([...(byMerchant.get(merchantId)?.receipts ?? [])]),
  };
}
