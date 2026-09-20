// Operator directory port (ADR-031): who holds a token, looked up by its fingerprint. The
// configuration lists the operators today; the store of the persistence feature will.
import type { Operator } from "../../../domain/admin/index.js";

export interface OperatorDirectory {
  /** The operator holding a token with this fingerprint, or undefined if nobody does. */
  findByTokenFingerprint(fingerprint: string): Promise<Operator | undefined>;
}
