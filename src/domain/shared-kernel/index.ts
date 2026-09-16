// Public API of the shared-kernel module (domain): branded identities.
export { asDecisionId, asEventId, asMerchantId, asSessionId, asVisitorId } from "./ids.js";
export type { DecisionId, EventId, MerchantId, SessionId, VisitorId } from "./ids.js";
export { hours, minutes, MS_PER_SECOND, seconds } from "./time.js";
