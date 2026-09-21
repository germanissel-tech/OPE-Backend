// Application service: the platform signature (ADR-029). A merchant with a signing secret must
// sign every platform request; the verifier runs in the security handler after the key resolved
// the merchant and before the body is validated. Not a use case (ADR-023): authentication.
import {
  PlatformSignature,
  SignatureExpired,
  SignatureInvalid,
  SignatureMissing,
  type Merchant,
  type SignatureError,
} from "../../../domain/merchant/index.js";
import { fail, ok, type Result } from "../../../domain/shared-kernel/index.js";
import type { MessageAuthenticator } from "../ports/message-authenticator.js";
import type { SignatureWindow } from "../ports/signature-window.js";

export interface SignedRequest {
  merchant: Merchant;
  /** `X-OPE-Timestamp` as sent, if at all. */
  timestamp: string | undefined;
  /** `X-OPE-Signature` as sent, if at all. */
  signature: string | undefined;
  /** The body bytes exactly as received. */
  body: Uint8Array;
  now: Date;
}

export type SignatureVerification = Result<void, SignatureError>;

export interface PlatformSignatureVerifier {
  verify(request: SignedRequest): Promise<SignatureVerification>;
}

export interface PlatformSignatureVerifierDependencies {
  authenticator: MessageAuthenticator;
  /** The window of the platform (level 1 of the configuration). */
  window: SignatureWindow;
}

export class DefaultPlatformSignatureVerifier implements PlatformSignatureVerifier {
  readonly #deps: PlatformSignatureVerifierDependencies;

  constructor(deps: PlatformSignatureVerifierDependencies) {
    this.#deps = deps;
  }

  async verify(request: SignedRequest): Promise<SignatureVerification> {
    const { merchant } = request;
    if (!merchant.requiresSignature(request.now)) return ok(undefined);
    if (request.timestamp === undefined || request.signature === undefined)
      return fail(new SignatureMissing());
    const timestamp = PlatformSignature.timestampOf(request.timestamp);
    const signature = PlatformSignature.parse(request.signature);
    if (timestamp === undefined || signature === undefined) return fail(new SignatureInvalid());
    if (!PlatformSignature.inWindow(timestamp, request.now, this.#deps.window.windowMs()))
      return fail(new SignatureExpired());
    const message = PlatformSignature.message(timestamp, request.body);
    for (const secret of merchant.signingSecrets(request.now)) {
      if (signature.matches(await this.#deps.authenticator.hmacSha256Hex(secret, message)))
        return ok(undefined);
    }
    return fail(new SignatureInvalid());
  }
}
