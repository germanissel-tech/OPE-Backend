// Public API of the shared-kernel module (domain): branded identities, results and errors, time,
// money, the vocabularies shared by modules (arms, barriers, anchors, NO_OP reasons) and the
// predicates every module judges numbers and secrets with.
export { asExperimentId, asMerchantId, asSessionId, asVisitorId } from "./ids.js";
export type { Branded, ExperimentId, MerchantId, SessionId, VisitorId } from "./ids.js";
export type { Arm } from "./arm.js";
export { CLOCK_SKEW_TOLERANCE_MS, hours, minutes, MS_PER_SECOND, seconds } from "./time.js";
export { isCount, isRate } from "./rate.js";
export { constantTimeEquals } from "./compare.js";
export { DomainError, IdempotencyConflict, InvalidMoney } from "./errors.js";
export type { SafeDetails, SharedKernelError } from "./errors.js";
export { Money } from "./money.js";
export type { MoneyRecord } from "./money.js";
export { fail, ok } from "./result.js";
export type { Fail, Ok, Result } from "./result.js";
export { NO_OP_REASONS } from "./no-op-reasons.js";
export type { NoOpReason } from "./no-op-reasons.js";
export { ANCHORS, INCENTIVE_KINDS } from "./intervention.js";
export type { Anchor, Incentive, IncentiveKind, Intervention } from "./intervention.js";
export { BARRIERS } from "./barrier.js";
export type { Barrier } from "./barrier.js";
