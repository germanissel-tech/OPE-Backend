// Public API of the shared-kernel module (domain): branded identities.
export { asDecisionId, asEventId, asExperimentId, asMerchantId, asSessionId, asVisitorId } from "./ids.js";
export type { DecisionId, EventId, ExperimentId, MerchantId, SessionId, VisitorId } from "./ids.js";
export type { Arm } from "./arm.js";
export { hours, minutes, MS_PER_SECOND, seconds } from "./time.js";
export { DomainError } from "./errors.js";
export type { ModuleName, SafeDetails } from "./errors.js";
export { fail, ok } from "./result.js";
export type { Fail, Ok, Result } from "./result.js";
export { NO_OP_REASONS } from "./no-op-reasons.js";
export type { NoOpReason } from "./no-op-reasons.js";
