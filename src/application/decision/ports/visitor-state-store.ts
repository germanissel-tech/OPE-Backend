// Visitor state store port (constitution IV: hot, bounded, expiring): what the plane remembers
// of a visitor across sessions, per merchant. Keyed by merchant and visitor; a visitor of
// another merchant does not exist for whoever asks (constitution V).
import type { VisitorState } from "../../../domain/decision/index.js";
import type { MerchantId, VisitorId } from "../../../domain/shared-kernel/index.js";

export interface VisitorStateStore {
  load(merchantId: MerchantId, visitorId: VisitorId): Promise<VisitorState | undefined>;
  save(merchantId: MerchantId, visitorId: VisitorId, state: VisitorState): Promise<void>;
}
