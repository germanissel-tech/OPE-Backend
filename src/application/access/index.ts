// Public API of the access module (application, ADR-034): who is who and what they may do. The
// four resolvers of the platform's credentials —the ingest key of the SDK, the platform key, the
// signature of a platform request and the token of an operator— and the ports they need. It reads
// the merchants through the directory and never writes to them.
export type { MessageAuthenticator } from "./ports/message-authenticator.js";
export type { SignatureWindow } from "./ports/signature-window.js";
export type { OperatorDirectory } from "./ports/operator-directory.js";
export type { TokenFingerprinter } from "./ports/token-fingerprinter.js";
export { DefaultIngestKeyResolver } from "./services/ingest-key.service.js";
export type {
  IngestKeyResolution,
  IngestKeyResolver,
  IngestKeyResolverDependencies,
} from "./services/ingest-key.service.js";
export { DefaultPlatformKeyResolver } from "./services/platform-key.service.js";
export type {
  PlatformKeyResolution,
  PlatformKeyResolver,
  PlatformKeyResolverDependencies,
} from "./services/platform-key.service.js";
export { DefaultPlatformSignatureVerifier } from "./services/platform-signature.service.js";
export type {
  PlatformSignatureVerifier,
  PlatformSignatureVerifierDependencies,
  SignatureVerification,
  SignedRequest,
} from "./services/platform-signature.service.js";
export { DefaultAdminTokenResolver } from "./services/admin-token.service.js";
export type {
  AdminTokenResolution,
  AdminTokenResolver,
  AdminTokenResolverDependencies,
} from "./services/admin-token.service.js";
