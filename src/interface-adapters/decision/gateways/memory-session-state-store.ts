// In-memory session state per merchant, applying the window the application declares
// (SESSION_WINDOW) through the shared bounded window: a save moves the session to the most
// recent position, the window is applied on every load, and the plane always loads a session
// before it saves it.
import { ok, type SessionId } from "../../../domain/shared-kernel/index.js";
import { boundedBy, windowedByMerchant } from "../../shared-kernel/index.js";
import type { SessionStateStore, SessionWindow } from "../../../application/decision/index.js";
import type { Clock } from "../../../application/shared-kernel/index.js";
import type { SessionState } from "../../../domain/decision/index.js";

export function memorySessionStateStore(clock: Clock, window: SessionWindow): SessionStateStore {
  const sessions = windowedByMerchant<SessionId, SessionState>(
    boundedBy(
      () => window.ttlMs,
      () => window.maxSessions,
    ),
    (state) => state.updatedAt.getTime(),
  );

  return {
    // Always `ok`, and **never** a failure: a `Map` cannot fail to answer. The channel exists for the
    // durable store, and here the failing branch does not exist rather than being unreachable code.
    load(merchantId, sessionId) {
      return Promise.resolve(ok(sessions.load(merchantId, sessionId, clock.now().getTime())));
    },
    save(merchantId, sessionId, state) {
      sessions.save(merchantId, sessionId, state);
      return Promise.resolve();
    },
  };
}
