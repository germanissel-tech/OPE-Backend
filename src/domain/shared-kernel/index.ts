// Public API of the shared-kernel module (domain): branded identities.
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
