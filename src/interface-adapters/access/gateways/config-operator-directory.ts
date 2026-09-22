// Operators as the configuration lists them (OPE_ADMIN_OPERATORS, ADR-031): looked up by token
// fingerprint. The store of the persistence feature replaces this without touching the core.
import type { OperatorDirectory } from "../../../application/access/index.js";
import type { Operator } from "../../../domain/operator/index.js";

export function configOperatorDirectory(operators: readonly Operator[]): OperatorDirectory {
  return {
    findByTokenFingerprint(fingerprint) {
      return Promise.resolve(operators.find((o) => o.holds(fingerprint)));
    },
  };
}
