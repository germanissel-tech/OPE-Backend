// In-memory visitor state per merchant, applying the window the application declares
// (VISITOR_WINDOW). One Map per merchant: they never cross. A save moves the visitor to the
// most recent position; the window is applied on every load, and the plane always loads a
// visitor before it saves it.
import type { VisitorStateStore, VisitorWindow } from "../../../application/decision/index.js";
import type { Clock } from "../../../application/shared-kernel/index.js";
import type { VisitorState } from "../../../domain/decision/index.js";
import type { MerchantId, VisitorId } from "../../../domain/shared-kernel/index.js";

export function memoryVisitorStateStore(clock: Clock, window: VisitorWindow): VisitorStateStore {
  const byMerchant = new Map<MerchantId, Map<VisitorId, VisitorState>>();

  const bucket = (merchantId: MerchantId): Map<VisitorId, VisitorState> => {
    let visitors = byMerchant.get(merchantId);
    if (!visitors) {
      visitors = new Map();
      byMerchant.set(merchantId, visitors);
    }
    return visitors;
  };

  const expire = (visitors: Map<VisitorId, VisitorState>, now: number): void => {
    for (const [id, state] of visitors) {
      const updatedAt = state.updatedAt()?.getTime() ?? 0;
      if (now - updatedAt < window.ttlMs) break;
      visitors.delete(id);
    }
    while (visitors.size > window.maxVisitors) {
      const oldest = visitors.keys().next();
      if (oldest.done) break;
      visitors.delete(oldest.value);
    }
  };

  return {
    load(merchantId, visitorId) {
      const visitors = bucket(merchantId);
      expire(visitors, clock.now().getTime());
      return Promise.resolve(visitors.get(visitorId));
    },
    save(merchantId, visitorId, state) {
      const visitors = bucket(merchantId);
      visitors.delete(visitorId);
      visitors.set(visitorId, state);
      return Promise.resolve();
    },
  };
}
