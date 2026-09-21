// Session state store port (constitution IV: hot, bounded, expiring): what the plane remembers
// of a session, per merchant. Keyed by merchant and session; a session of another merchant does
// not exist for whoever asks (constitution V).
import type { SessionState } from "../../../domain/decision/index.js";
import type { MerchantId, SessionId } from "../../../domain/shared-kernel/index.js";

/** How long, and how many, sessions the plane remembers per merchant (level 1 of the configuration). */
export interface SessionWindow {
  /** States untouched for longer than this are forgotten. */
  ttlMs: number;
  /** States kept per merchant at most; the least recently updated go first. */
  maxSessions: number;
}

export interface SessionStateStore {
  load(merchantId: MerchantId, sessionId: SessionId): Promise<SessionState | undefined>;
  save(merchantId: MerchantId, sessionId: SessionId, state: SessionState): Promise<void>;
}
