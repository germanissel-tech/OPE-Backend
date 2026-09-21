// In-memory visitor state per merchant, applying the window the application declares
// (VISITOR_WINDOW) through the shared bounded window: a save moves the visitor to the most
// recent position, the window is applied on every load, and the plane always loads a visitor
// before it saves it. A visitor never intervened counts as touched at the epoch.
import { windowedByMerchant } from "../../shared-kernel/index.js";
import type { VisitorStateStore, VisitorWindow } from "../../../application/decision/index.js";
import type { Clock } from "../../../application/shared-kernel/index.js";
import type { VisitorState } from "../../../domain/decision/index.js";
import type { VisitorId } from "../../../domain/shared-kernel/index.js";

export function memoryVisitorStateStore(clock: Clock, window: VisitorWindow): VisitorStateStore {
  const visitors = windowedByMerchant<VisitorId, VisitorState>(
    { ttlMs: window.ttlMs, max: window.maxVisitors },
    (state) => state.updatedAt()?.getTime() ?? 0,
  );

  return {
    load(merchantId, visitorId) {
      return Promise.resolve(visitors.load(merchantId, visitorId, clock.now().getTime()));
    },
    save(merchantId, visitorId, state) {
      visitors.save(merchantId, visitorId, state);
      return Promise.resolve();
    },
  };
}
