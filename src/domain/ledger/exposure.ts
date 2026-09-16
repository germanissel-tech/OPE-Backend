// Exposición (01-arquitectura-mvp.md §0.1, §5): que una intervención efectivamente se renderizó
// y fue visible, confirmado por el SDK. Es lo que constituye el estado EXPOSED de la cadena de
// evidencia; la decisión sola no lo implica.
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
