// Public API of the merchant module (domain).
export { findByIngestKey, normalizeOrigin, originAllowed } from "./merchant.js";
export type { Merchant } from "./merchant.js";
export { OriginNotAllowed, Unauthorized } from "./errors.js";
export type { MerchantError } from "./errors.js";
