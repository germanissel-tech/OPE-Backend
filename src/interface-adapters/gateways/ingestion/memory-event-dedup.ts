// Deduplicación en memoria por merchant: ventana de 24 h o 100 000 ids, lo que ocurra antes
// (declarada en la descripción de ingestEvents). Un Map por merchant: nunca se cruzan.
import type { EventDedup } from "../../../application/ingestion/index.js";
import type { Clock } from "../../../application/shared-kernel/index.js";
import type { EventId, MerchantId } from "../../../domain/shared-kernel/index.js";

export interface DedupWindow {
  ttlMs: number;
  maxIds: number;
}

export const DEDUP_WINDOW: DedupWindow = { ttlMs: 24 * 60 * 60 * 1000, maxIds: 100_000 };

export function memoryEventDedup(clock: Clock, window: DedupWindow = DEDUP_WINDOW): EventDedup {
  // Map conserva el orden de inserción: el primero es el más viejo.
  const byMerchant = new Map<MerchantId, Map<EventId, number>>();

  const bucket = (merchantId: MerchantId): Map<EventId, number> => {
    let seen = byMerchant.get(merchantId);
    if (!seen) {
      seen = new Map();
      byMerchant.set(merchantId, seen);
    }
    return seen;
  };

  const expire = (seen: Map<EventId, number>, now: number): void => {
    for (const [id, at] of seen) {
      if (now - at < window.ttlMs) break;
      seen.delete(id);
    }
    while (seen.size > window.maxIds) {
      const oldest = seen.keys().next();
      if (oldest.done) break;
      seen.delete(oldest.value);
    }
  };

  return {
    claim(merchantId, eventIds) {
      const now = clock.now().getTime();
      const seen = bucket(merchantId);
      expire(seen, now);
      const entered = new Set<EventId>();
      for (const id of eventIds) {
        if (seen.has(id)) continue;
        seen.set(id, now);
        entered.add(id);
      }
      expire(seen, now);
      return entered;
    },
  };
}
