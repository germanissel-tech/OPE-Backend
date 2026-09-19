// Security handler `platformKey` (ADR-025, ADR-029): the server-to-server credential of the
// merchant's platform identifies the merchant; with a signing secret configured, the request
// must also carry a valid signature of its bytes. No origin applies (there is no browser).
// Runs before body validation and before the controller (openapi-backend).
import { SecurityError, type SecurityHandler } from "../typed.js";
import { CONSUMER_CAPABILITIES } from "./capabilities.js";
import { header } from "./headers.js";
import type { PlatformKeyResolver, PlatformSignatureVerifier } from "../../../application/merchant/index.js";
import type { Clock } from "../../../application/shared-kernel/index.js";
import type { Merchant } from "../../../domain/merchant/index.js";

export const PLATFORM_KEY_SCHEME = "platformKey";
/** The header that carries the credential; the wiring declares it so CORS and log redaction derive from it. */
export const PLATFORM_KEY_HEADER = "x-ope-platform-key";
/** The signature headers (ADR-029): seconds since the epoch, and `v1=<hex HMAC-SHA256>`. */
const PLATFORM_TIMESTAMP_HEADER = "x-ope-timestamp";
const PLATFORM_SIGNATURE_HEADER = "x-ope-signature";

/** What the security handler leaves for the controllers. */
export interface PlatformPrincipal {
  merchant: Merchant;
}

export interface PlatformSecurityDependencies {
  keys: PlatformKeyResolver;
  signatures: PlatformSignatureVerifier;
  clock: Clock;
}

export function makePlatformKeySecurity(deps: PlatformSecurityDependencies): SecurityHandler {
  return async ({ headers, rawBody }) => {
    const result = await deps.keys.resolve(header(headers, PLATFORM_KEY_HEADER));
    if (!result.ok) throw new SecurityError(result.error.code);
    const merchant = result.value;
    const verified = await deps.signatures.verify({
      merchant,
      timestamp: header(headers, PLATFORM_TIMESTAMP_HEADER),
      signature: header(headers, PLATFORM_SIGNATURE_HEADER),
      body: rawBody ?? new Uint8Array(),
      now: deps.clock.now(),
    });
    if (!verified.ok) throw new SecurityError(verified.error.code);
    const principal: PlatformPrincipal = { merchant };
    return {
      principal,
      capabilities: CONSUMER_CAPABILITIES.platform,
      log: { merchantId: merchant.merchantId },
    };
  };
}
