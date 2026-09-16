// In-memory deduplication per merchant: window of 24 h or 100,000 ids, whichever comes first
// (declared in the description of ingestEvents). One Map per merchant: they never cross.
import { hours, type EventId, type MerchantId } from "../../../domain/shared-kernel/index.js";
import type { EventDedup } from "../../../application/ingestion/index.js";
import type { Clock } from "../../../application/shared-kernel/index.js";

export interface DedupWindow {
  ttlMs: number;
  maxIds: number;
}

// 24 h or 100,000 ids per merchant, whichever comes first (declared in the description of ingestEvents).
const DEDUP_TTL_HOURS = 24;
const DEDUP_MAX_IDS = 100_000;
export const DEDUP_WINDOW: DedupWindow = { ttlMs: hours(DEDUP_TTL_HOURS), maxIds: DEDUP_MAX_IDS };

export function memoryEventDedup(clock: Clock, window: DedupWindow = DEDUP_WINDOW): EventDedup {
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
      return entered;
    },
  };
}
