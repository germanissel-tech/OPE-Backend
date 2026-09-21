// Public API of the merchant module (application).
export type { MerchantDirectory } from "./ports/merchant-directory.js";
export type { MessageAuthenticator } from "./ports/message-authenticator.js";
export type { MerchantStore } from "./ports/merchant-store.js";
export type { CredentialMinter, MintedCredential } from "./ports/credential-minter.js";
export type { RotationPolicy } from "./ports/rotation-policy.js";
export type { SignatureWindow } from "./ports/signature-window.js";
export { DefaultPlatformSignatureVerifier } from "./services/platform-signature.service.js";
export type {
  PlatformSignatureVerifier,
  PlatformSignatureVerifierDependencies,
  SignatureVerification,
  SignedRequest,
} from "./services/platform-signature.service.js";
export { DefaultIngestKeyResolver } from "./services/ingest-key.service.js";
export { DefaultPlatformKeyResolver } from "./services/platform-key.service.js";
export type {
  PlatformKeyResolution,
  PlatformKeyResolver,
  PlatformKeyResolverDependencies,
} from "./services/platform-key.service.js";
export type {
  IngestKeyResolution,
  IngestKeyResolver,
  IngestKeyResolverDependencies,
} from "./services/ingest-key.service.js";
export { DefaultScopedMerchantService } from "./services/scoped-merchant.service.js";
export type {
  ScopedMerchant,
  ScopedMerchantService,
  ScopedMerchantServiceDependencies,
} from "./services/scoped-merchant.service.js";
export { CreateMerchantUseCase } from "./use-cases/create-merchant.use-case.js";
export type {
  CreateMerchantDependencies,
  CreateMerchantFailure,
  CreateMerchantRequest,
  CreateMerchantResponse,
} from "./use-cases/create-merchant.use-case.js";
export { GetMerchantUseCase } from "./use-cases/get-merchant.use-case.js";
export type {
  GetMerchantDependencies,
  GetMerchantRequest,
  GetMerchantResponse,
} from "./use-cases/get-merchant.use-case.js";
export { ListMerchantsUseCase } from "./use-cases/list-merchants.use-case.js";
export type {
  ListMerchantsDependencies,
  ListMerchantsRequest,
  ListMerchantsResponse,
} from "./use-cases/list-merchants.use-case.js";
export { RotateCredentialUseCase } from "./use-cases/rotate-credential.use-case.js";
export type {
  RotateCredentialDependencies,
  RotateCredentialRequest,
  RotateCredentialResponse,
  RotateCredentialResult,
} from "./use-cases/rotate-credential.use-case.js";
export { SetKillSwitchUseCase } from "./use-cases/set-kill-switch.use-case.js";
export type {
  SetKillSwitchDependencies,
  SetKillSwitchRequest,
  SetKillSwitchResponse,
} from "./use-cases/set-kill-switch.use-case.js";
export { DeactivateMerchantUseCase } from "./use-cases/deactivate-merchant.use-case.js";
export type {
  DeactivateMerchantDependencies,
  DeactivateMerchantRequest,
  DeactivateMerchantResponse,
} from "./use-cases/deactivate-merchant.use-case.js";
export { ImportMerchantsUseCase } from "./use-cases/import-merchants.use-case.js";
export type {
  ImportMerchantsDependencies,
  ImportMerchantsRequest,
  ImportMerchantsResponse,
  MerchantSeed,
} from "./use-cases/import-merchants.use-case.js";
