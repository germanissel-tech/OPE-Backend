// Security handler `ingestKey` (ADR-014): the credential identifies the merchant and, if the
// request carries Origin, it must be a registered origin of that merchant. Runs before body
// validation and before the controller (openapi-backend).
import { SecurityError, type SecurityHandler, type SecurityRequest, type SecurityResults } from "../typed.js";
import type {
  ResolveIngestKeyRequest,
  ResolveIngestKeyResponse,
} from "../../../application/merchant/index.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { Merchant } from "../../../domain/merchant/index.js";

export const INGEST_KEY_SCHEME = "ingestKey";
const INGEST_KEY_HEADER = "x-ope-ingest-key";

/** What the security handler leaves for the controllers. */
export interface IngestPrincipal {
  merchant: Merchant;
}

function header(headers: SecurityRequest["headers"], name: string): string | undefined {
  const value = headers[name];
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
  return undefined;
}

export function makeIngestKeySecurity(
  resolveIngestKey: UseCase<ResolveIngestKeyRequest, ResolveIngestKeyResponse>,
): SecurityHandler {
  return async ({ headers }) => {
    const result = await resolveIngestKey.execute({
      key: header(headers, INGEST_KEY_HEADER),
      origin: header(headers, "origin"),
    });
    if (!result.ok) throw new SecurityError(result.error.code);
    const principal: IngestPrincipal = { merchant: result.value };
    return { principal, log: { merchantId: result.value.merchantId } };
  };
}

/** The authenticated merchant of the request. If missing, the wiring is broken: not a business case. */
export function merchantOf(req: { security: SecurityResults }): Merchant {
  const principal = req.security[INGEST_KEY_SCHEME];
  if (typeof principal === "object" && principal !== null && "merchant" in principal) {
    return (principal as IngestPrincipal).merchant;
  }
  throw new Error(`The operation did not go through the ${INGEST_KEY_SCHEME} security handler.`);
}
