// Security handler `ingestKey` (ADR-014): the credential identifies the merchant and, if the
// request carries Origin, it must be a registered origin of that merchant. Runs before body
// validation and before the controller (openapi-backend).
import { CONSUMER_CAPABILITIES } from "../../http/security/capabilities.js";
import { header } from "../../http/security/headers.js";
import { SecurityError, type SecurityHandler } from "../../http/typed.js";
import type { IngestKeyResolver } from "../../../application/merchant/index.js";
import type { MerchantPrincipal } from "../../http/security/principal.js";

export const INGEST_KEY_SCHEME = "ingestKey";
/** The header that carries the credential; the wiring declares it so CORS and log redaction derive from it. */
export const INGEST_KEY_HEADER = "x-ope-ingest-key";

export function makeIngestKeySecurity(resolver: IngestKeyResolver): SecurityHandler {
  return async ({ headers }) => {
    const result = await resolver.resolve(header(headers, INGEST_KEY_HEADER), header(headers, "origin"));
    if (!result.ok) throw new SecurityError(result.error.code);
    const principal: MerchantPrincipal = { merchant: result.value };
    return {
      principal,
      capabilities: CONSUMER_CAPABILITIES.sdk,
      log: { merchantId: result.value.merchantId },
    };
  };
}
