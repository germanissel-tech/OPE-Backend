// In-memory deduplication per merchant, applying the window the application declares
// (DEDUP_WINDOW, ADR-024) through the shared bounded window: one Map per merchant, the ids
// entering the window with the instant they were claimed.
import { windowedByMerchant } from "../../shared-kernel/index.js";
import type { DedupWindow, EventDedup } from "../../../application/ingestion/index.js";
import type { Clock } from "../../../application/shared-kernel/index.js";
import type { EventId } from "../../../domain/ingestion/index.js";

export function memoryEventDedup(clock: Clock, window: DedupWindow): EventDedup {
  const seen = windowedByMerchant<EventId, number>({ ttlMs: window.ttlMs, max: window.maxIds }, (at) => at);

  return {
    claim(merchantId, eventIds) {
      const now = clock.now().getTime();
      const entered = new Set<EventId>();
      for (const id of eventIds) {
        if (seen.load(merchantId, id, now) !== undefined) continue;
        seen.save(merchantId, id, now);
        entered.add(id);
      }
      return Promise.resolve(entered);
    },
  };
}
