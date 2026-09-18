// Security handler `ingestKey` (ADR-014): the credential identifies the merchant and, if the
// request carries Origin, it must be a registered origin of that merchant. Runs before body
// validation and before the controller (openapi-backend).
import { SecurityError, type SecurityHandler, type SecurityResults } from "../typed.js";
import { CONSUMER_CAPABILITIES } from "./capabilities.js";
import { header } from "./headers.js";
import type { IngestKeyResolver } from "../../../application/merchant/index.js";
import type { Merchant } from "../../../domain/merchant/index.js";

export const INGEST_KEY_SCHEME = "ingestKey";
/** The header that carries the credential; the wiring declares it so CORS and log redaction derive from it. */
export const INGEST_KEY_HEADER = "x-ope-ingest-key";

/** What the security handler leaves for the controllers. */
export interface IngestPrincipal {
  merchant: Merchant;
}

export function makeIngestKeySecurity(resolver: IngestKeyResolver): SecurityHandler {
  return async ({ headers }) => {
    const result = await resolver.resolve(header(headers, INGEST_KEY_HEADER), header(headers, "origin"));
    if (!result.ok) throw new SecurityError(result.error.code);
    const principal: IngestPrincipal = { merchant: result.value };
    return {
      principal,
      capabilities: CONSUMER_CAPABILITIES.sdk,
      log: { merchantId: result.value.merchantId },
    };
  };
}

/**
 * The authenticated merchant of the request, whichever scheme (ingest or platform key) resolved
 * it. If missing, the wiring is broken: not a business case.
 */
export function merchantOf(req: { security: SecurityResults }): Merchant {
  const principal = Object.values(req.security).find((p) => typeof p === "object" && p !== null);
  if (principal !== undefined && "merchant" in principal) return (principal as IngestPrincipal).merchant;
  throw new Error("The operation did not go through a merchant security handler.");
}
