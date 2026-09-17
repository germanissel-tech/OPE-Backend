// Public API of the shared-kernel module (domain): branded identities.
export { asDecisionId, asEventId, asExperimentId, asMerchantId, asSessionId, asVisitorId } from "./ids.js";
export type { DecisionId, EventId, ExperimentId, MerchantId, SessionId, VisitorId } from "./ids.js";
export type { Arm } from "./arm.js";
export { hours, minutes, MS_PER_SECOND, seconds } from "./time.js";
