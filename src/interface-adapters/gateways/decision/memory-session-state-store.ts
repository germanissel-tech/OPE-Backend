// In-memory session state per merchant, applying the window the application declares
// (SESSION_WINDOW). One Map per merchant: they never cross. A save moves the session to the
// most recent position, so the oldest entries are the least recently updated; the window is
// applied on every load, and the plane always loads a session before it saves it.
import type { SessionStateStore, SessionWindow } from "../../../application/decision/index.js";
import type { Clock } from "../../../application/shared-kernel/index.js";
import type { SessionState } from "../../../domain/decision/index.js";
import type { MerchantId, SessionId } from "../../../domain/shared-kernel/index.js";

export function memorySessionStateStore(clock: Clock, window: SessionWindow): SessionStateStore {
  const byMerchant = new Map<MerchantId, Map<SessionId, SessionState>>();

  const bucket = (merchantId: MerchantId): Map<SessionId, SessionState> => {
    let sessions = byMerchant.get(merchantId);
    if (!sessions) {
      sessions = new Map();
      byMerchant.set(merchantId, sessions);
    }
    return sessions;
  };

  const expire = (sessions: Map<SessionId, SessionState>, now: number): void => {
    for (const [id, state] of sessions) {
      if (now - state.updatedAt.getTime() < window.ttlMs) break;
      sessions.delete(id);
    }
    while (sessions.size > window.maxSessions) {
      const oldest = sessions.keys().next();
      if (oldest.done) break;
      sessions.delete(oldest.value);
    }
  };

  return {
    load(merchantId, sessionId) {
      const sessions = bucket(merchantId);
      expire(sessions, clock.now().getTime());
      return Promise.resolve(sessions.get(sessionId));
    },
    save(merchantId, sessionId, state) {
      const sessions = bucket(merchantId);
      sessions.delete(sessionId);
      sessions.set(sessionId, state);
      return Promise.resolve();
    },
  };
}
