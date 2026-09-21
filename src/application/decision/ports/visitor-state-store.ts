// Visitor state store port (constitution IV: hot, bounded, expiring): what the plane remembers
// of a visitor across sessions, per merchant. Keyed by merchant and visitor; a visitor of
// another merchant does not exist for whoever asks (constitution V).
import type { VisitorState } from "../../../domain/decision/index.js";
import type { MerchantId, VisitorId } from "../../../domain/shared-kernel/index.js";

/** How long, and how many, visitors the plane remembers per merchant for the fatigue limit (level 1 of the configuration). */
export interface VisitorWindow {
  /** Interventions older than this no longer count; a visitor untouched for this long is forgotten. */
  ttlMs: number;
  /** Visitors kept per merchant at most; the least recently updated go first. */
  maxVisitors: number;
}

export interface VisitorStateStore {
  load(merchantId: MerchantId, visitorId: VisitorId): Promise<VisitorState | undefined>;
  save(merchantId: MerchantId, visitorId: VisitorId, state: VisitorState): Promise<void>;
}
