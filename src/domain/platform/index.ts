// Public API of the platform module (domain): the values that govern how OPE reads a merchant's platform
// (ADR-047) and their errors.
export type { PlatformPolicyError } from "./errors.js";
export { NoticeRetry } from "./notice-retry.js";
export type { NoticeRetryRecord } from "./notice-retry.js";
export { OrderConfirmation } from "./order-confirmation.js";
export { SyncCadence } from "./sync-cadence.js";
export type { SyncCadenceRecord } from "./sync-cadence.js";
