// API pública del módulo shared-kernel (dominio): identidades marcadas.
export {
  ID_PATTERN,
  asDecisionId,
  asEventId,
  asMerchantId,
  asSessionId,
  asVisitorId,
  isWellFormedId,
} from "./ids.js";
export type { DecisionId, EventId, MerchantId, SessionId, VisitorId } from "./ids.js";
