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
export { hours, minutes, MINUTES_PER_HOUR, MS_PER_SECOND, seconds, SECONDS_PER_MINUTE } from "./time.js";
