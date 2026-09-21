// Public API of the operator module (domain): who administers OPE and within which scope. Its
// own module because merchant, configuration and experiment need the actor without depending
// on admin (which depends on them).
export { MerchantOutOfScope, OperatorUnknown } from "./errors.js";
export type { OperatorError } from "./errors.js";
export { asOperatorId } from "./ids.js";
export type { OperatorId } from "./ids.js";
export { EVERY_MERCHANT, Operator } from "./operator.js";
export type { OperatorRecord, OperatorScope } from "./operator.js";
