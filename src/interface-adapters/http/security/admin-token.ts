// adminToken (ADR-020, ADR-031): `Authorization: Bearer <token>` of an operator of OPE. The
// operator is resolved by the fingerprint of the token before the body is read; a missing,
// malformed or unknown token is 401 operator-unknown. The scope is judged later, per merchant,
// by the use case: the handler does not know the route.
import { SecurityError, type SecurityHandler } from "../typed.js";
import { CONSUMER_CAPABILITIES } from "./capabilities.js";
import { header } from "./headers.js";
import type { OperatorPrincipal } from "./principal.js";
import type { AdminTokenResolver } from "../../../application/admin/index.js";

export const ADMIN_TOKEN_SCHEME = "adminToken";
/** The header that carries the credential; the wiring declares it so the log redacts it. */
export const ADMIN_TOKEN_HEADER = "authorization";

const BEARER = /^Bearer\s+(\S+)\s*$/i;

/** The token of a bearer authorization header, or undefined when the header is not one. */
function bearerOf(value: string | undefined): string | undefined {
  return value === undefined ? undefined : BEARER.exec(value)?.[1];
}

export function makeAdminTokenSecurity(resolver: AdminTokenResolver): SecurityHandler {
  return async ({ headers }) => {
    const result = await resolver.resolve(bearerOf(header(headers, ADMIN_TOKEN_HEADER)));
    if (!result.ok) throw new SecurityError(result.error.code);
    const principal: OperatorPrincipal = { operator: result.value };
    return {
      principal,
      capabilities: CONSUMER_CAPABILITIES.admin,
      log: { operatorId: result.value.operatorId },
    };
  };
}
