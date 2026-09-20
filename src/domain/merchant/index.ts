// Public API of the merchant module (domain).
export {
  InvalidIngestKeys,
  InvalidOrigin,
  InvalidOrigins,
  InvalidPlatformKeys,
  InvalidPlatformSecret,
  InvalidPlatformSecrets,
  OriginNotAllowed,
  PlatformKeyCollision,
  SignatureExpired,
  SignatureInvalid,
  SignatureMissing,
  Unauthorized,
} from "./errors.js";
export type { MerchantError, SignatureError } from "./errors.js";
export { PlatformSignature } from "./platform-signature.js";
export { Merchant } from "./merchant.js";
export type { MerchantInput, MerchantRecord } from "./merchant.js";
export { Origin } from "./origin.js";
