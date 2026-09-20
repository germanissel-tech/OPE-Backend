// Public API of the merchant module (domain).
export {
  InvalidIngestKeys,
  InvalidOrigin,
  InvalidOrigins,
  InvalidPlatformKeys,
  InvalidPlatformSecret,
  InvalidPlatformSecrets,
  MerchantDeactivated,
  MerchantNotFound,
  OriginAlreadyRegistered,
  OriginNotAllowed,
  PlatformKeyCollision,
  RotationGraceTooLong,
  SignatureExpired,
  SignatureInvalid,
  SignatureMissing,
  Unauthorized,
} from "./errors.js";
export type { MerchantError, SignatureError } from "./errors.js";
export { PlatformSignature } from "./platform-signature.js";
export { Merchant } from "./merchant.js";
export type { MerchantInput, MerchantRecord, MerchantStatus } from "./merchant.js";
export type { Credential, CredentialKind } from "./credential.js";
export { Origin } from "./origin.js";
