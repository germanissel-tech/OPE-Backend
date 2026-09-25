// In-memory unmapped attribute values (01 §3.1.1, feature 027): what the last catalogue of each
// merchant brought with no correspondence, bounded per merchant (the oldest goes first). The order
// kept is by first sighting, oldest first, which is the order the limit consumes and the reverse of
// the one the report shows.
import { pageOf } from "../../shared-kernel/index.js";
import type { UnmappedValueLog, UnmappedValueSighting } from "../../../application/admin/index.js";
import type { UnmappedAttributeValue } from "../../../domain/admin/index.js";
import type { MerchantId } from "../../../domain/shared-kernel/index.js";

export function memoryUnmappedValueLog(kept: number): UnmappedValueLog {
  const byMerchant = new Map<MerchantId, Map<string, UnmappedAttributeValue>>();
  return {
    replace(merchantId, seen, at) {
      const previous = byMerchant.get(merchantId);
      const held = seen.map((sighting: UnmappedValueSighting): UnmappedAttributeValue => ({
        merchantId,
        label: sighting.label,
        products: sighting.products,
        firstSeenAt: previous?.get(sighting.label)?.firstSeenAt ?? at,
        lastSeenAt: at,
      }));
      // Oldest first so the limit consumes the oldest; a stable sort keeps the catalogue's order
      // among the ones first seen in this same catalogue.
      held.sort((a, b) => a.firstSeenAt.getTime() - b.firstSeenAt.getTime());
      // The last `kept` of the order above, which is the newest: a negative start already returns
      // them all when fewer than `kept` arrived, so no floor is needed.
      byMerchant.set(merchantId, new Map(held.slice(-kept).map((v) => [v.label, v])));
      return Promise.resolve();
    },
    pendingOf(merchantId, mapped, query) {
      const held = [...(byMerchant.get(merchantId)?.values() ?? [])];
      const items = held.filter((value) => !mapped.has(value.label)).reverse();
      return Promise.resolve(pageOf(items, query));
    },
  };
}
