// Session state store port (constitution IV: hot, bounded, expiring): what the plane remembers
// of a session, per merchant. Keyed by merchant and session; a session of another merchant does
// not exist for whoever asks (constitution V).
import type { SessionState } from "../../../domain/decision/index.js";
import type { MerchantId, SessionId } from "../../../domain/shared-kernel/index.js";

export interface SessionStateStore {
  load(merchantId: MerchantId, sessionId: SessionId): Promise<SessionState | undefined>;
  save(merchantId: MerchantId, sessionId: SessionId, state: SessionState): Promise<void>;
}
