// Session state store port (constitution IV: hot, bounded, expiring): what the plane remembers
// of a session, per merchant. Keyed by merchant and session; a session of another merchant does
// not exist for whoever asks (constitution V).
import type { SessionState, StateUnavailable } from "../../../domain/decision/index.js";
import type { MerchantId, Result, SessionId } from "../../../domain/shared-kernel/index.js";

/** How long, and how many, sessions the plane remembers per merchant (level 1 of the configuration). */
export interface SessionWindow {
  /** States untouched for longer than this are forgotten. */
  ttlMs: number;
  /** States kept per merchant at most; the least recently updated go first. */
  maxSessions: number;
}

/**
 * The three answers of a read, as three values (feature 032, FR-012).
 *
 * `ok(state)` is "I remember it", `ok(undefined)` is "I do not" — the normal case, the first batch of a
 * visit — and `fail(StateUnavailable)` is **"I could not determine it"**. Before this feature the first
 * two were enough, because forgetting was the only thing that could happen to a `Map`. Once the answer
 * can come from a durable store, `undefined` would mean both "new" and "the store did not answer", and
 * the plane would hand a failure the whole quota of a new visitor.
 *
 * **This is one point of the persistence milestone brought forward, not an invention of this feature.**
 * "Read ports with a failure channel" is declared as work of `persistence-and-resilience` in
 * `interface-adapters/ledger/gateways/durable-write.ts`, and it is done here in the two ports that need
 * it now. Every other read still throws, and that is said out loud so the day the rest is done these two
 * do not look like the exception.
 */
export type Recalled<T> = Result<T | undefined, StateUnavailable>;

export interface SessionStateStore {
  load(merchantId: MerchantId, sessionId: SessionId): Promise<Recalled<SessionState>>;
  save(merchantId: MerchantId, sessionId: SessionId, state: SessionState): Promise<void>;
}
