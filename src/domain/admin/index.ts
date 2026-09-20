// Public API of the admin module (domain).
export { MerchantOutOfScope, OperatorUnknown } from "./errors.js";
export type { AdminError } from "./errors.js";
export { asOperatorId } from "./ids.js";
export type { OperatorId } from "./ids.js";
export { EVERY_MERCHANT, Operator } from "./operator.js";
export type { OperatorRecord, OperatorScope } from "./operator.js";
export type { AdminEntry, AdminOutcome, AdminResult } from "./admin-entry.js";
export type { AnchorDiagnostic } from "./anchor-diagnostic.js";
