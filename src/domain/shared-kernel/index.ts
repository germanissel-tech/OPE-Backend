// Public API of the shared-kernel module (domain): what modules that cannot depend on each
// other share — branded identities, Result/DomainError, Money, time units, the closed
// vocabularies replicated from the contract (arms, barriers, anchors, NO_OP reasons) and the
// predicates every module judges numbers and secrets with.
export { asExperimentId, asMerchantId, asSessionId, asVisitorId } from "./ids.js";
export type { Branded, ExperimentId, MerchantId, SessionId, VisitorId } from "./ids.js";
export type { Arm } from "./arm.js";
export { hours, minutes, MS_PER_SECOND, seconds } from "./time.js";
export { isCount, isRate } from "./rate.js";
export { constantTimeEquals } from "./compare.js";
export { DomainError, IdempotencyConflict, InvalidMoney, StoreUnavailable } from "./errors.js";
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
export type { ConfigurationVersions } from "./configuration-versions.js";
