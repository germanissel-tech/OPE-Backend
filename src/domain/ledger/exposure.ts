// Exposure (01-arquitectura-mvp.md §0.1, §5): that an intervention was actually rendered and
// visible, confirmed by the SDK. It is what constitutes the EXPOSED state of the evidence
// chain; the decision alone does not imply it.
import type { Anchor } from "./decision.js";
import type { DecisionId, MerchantId, SessionId, VisitorId } from "../shared-kernel/index.js";

export const EXPOSED = "EXPOSED";

export interface Exposure {
  merchantId: MerchantId;
  decisionId: DecisionId;
  sessionId: SessionId;
  visitorId: VisitorId;
  exposedAt: Date;
  anchor: Anchor;
}
