// Security handler `platformKey` (ADR-025): the server-to-server credential of the merchant's
// platform identifies the merchant. No origin applies (there is no browser). Runs before body
// validation and before the controller (openapi-backend).
import { SecurityError, type SecurityHandler } from "../typed.js";
import { CONSUMER_CAPABILITIES } from "./capabilities.js";
import { header } from "./headers.js";
import type { PlatformKeyResolver } from "../../../application/merchant/index.js";
import type { Merchant } from "../../../domain/merchant/index.js";

export const PLATFORM_KEY_SCHEME = "platformKey";
/** The header that carries the credential; the wiring declares it so CORS and log redaction derive from it. */
export const PLATFORM_KEY_HEADER = "x-ope-platform-key";

/** What the security handler leaves for the controllers. */
export interface PlatformPrincipal {
  merchant: Merchant;
}

export function makePlatformKeySecurity(resolver: PlatformKeyResolver): SecurityHandler {
  return async ({ headers }) => {
    const result = await resolver.resolve(header(headers, PLATFORM_KEY_HEADER));
    if (!result.ok) throw new SecurityError(result.error.code);
    const principal: PlatformPrincipal = { merchant: result.value };
    return {
      principal,
      capabilities: CONSUMER_CAPABILITIES.platform,
      log: { merchantId: result.value.merchantId },
    };
  };
}
