// Security handler `ingestKey` (ADR-014): la credencial identifica al merchant y, si el request
// trae Origin, tiene que ser un origen registrado de ese merchant. Corre antes de la validación
// del body y antes del controller (openapi-backend).
import { SecurityError, type SecurityHandler, type SecurityRequest, type SecurityResults } from "../typed.js";
import type { ResolveIngestKey } from "../../../application/merchant/index.js";
import type { Merchant } from "../../../domain/merchant/index.js";

export const INGEST_KEY_SCHEME = "ingestKey";
export const INGEST_KEY_HEADER = "x-ope-ingest-key";

/** Lo que el security handler deja para los controllers. */
export interface IngestPrincipal {
  merchant: Merchant;
}

function header(headers: SecurityRequest["headers"], name: string): string | undefined {
  const value = headers[name];
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return typeof value[0] === "string" ? value[0] : undefined;
  return undefined;
}

export function makeIngestKeySecurity(resolveIngestKey: ResolveIngestKey): SecurityHandler {
  return ({ headers }) => {
    const result = resolveIngestKey({
      key: header(headers, INGEST_KEY_HEADER),
      origin: header(headers, "origin"),
    });
    if (!result.ok) throw new SecurityError(result.reason);
    const principal: IngestPrincipal = { merchant: result.merchant };
    return { principal, log: { merchantId: result.merchant.merchantId } };
  };
}

/** El merchant autenticado del request. Si falta, el cableado está roto: no es un caso de negocio. */
export function merchantOf(req: { security: SecurityResults }): Merchant {
  const principal = req.security[INGEST_KEY_SCHEME];
  if (typeof principal === "object" && principal !== null && "merchant" in principal) {
    return (principal as IngestPrincipal).merchant;
  }
  throw new Error(`La operación no pasó por el security handler ${INGEST_KEY_SCHEME}.`);
}
