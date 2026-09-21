// In-memory session state per merchant, applying the window the application declares
// (SESSION_WINDOW) through the shared bounded window: a save moves the session to the most
// recent position, the window is applied on every load, and the plane always loads a session
// before it saves it.
import { windowedByMerchant } from "../../shared-kernel/windowed-map.js";
import type { SessionStateStore, SessionWindow } from "../../../application/decision/index.js";
import type { Clock } from "../../../application/shared-kernel/index.js";
import type { SessionState } from "../../../domain/decision/index.js";
import type { SessionId } from "../../../domain/shared-kernel/index.js";

export function memorySessionStateStore(clock: Clock, window: SessionWindow): SessionStateStore {
  const sessions = windowedByMerchant<SessionId, SessionState>(
    { ttlMs: window.ttlMs, max: window.maxSessions },
    (state) => state.updatedAt.getTime(),
  );

  return {
    load(merchantId, sessionId) {
      return Promise.resolve(sessions.load(merchantId, sessionId, clock.now().getTime()));
    },
    save(merchantId, sessionId, state) {
      sessions.save(merchantId, sessionId, state);
      return Promise.resolve();
    },
  };
}
