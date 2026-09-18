// In-memory deduplication per merchant, applying the window the application declares
// (DEDUP_WINDOW, ADR-024). One Map per merchant: they never cross.
import type { DedupWindow, EventDedup } from "../../../application/ingestion/index.js";
import type { Clock } from "../../../application/shared-kernel/index.js";
import type { EventId } from "../../../domain/ingestion/index.js";
import type { MerchantId } from "../../../domain/shared-kernel/index.js";

export function memoryEventDedup(clock: Clock, window: DedupWindow): EventDedup {
  // Map preserves insertion order: the first one is the oldest.
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
      return Promise.resolve(entered);
    },
  };
}
