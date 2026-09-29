// Business errors of the decision module (ADR-023, ADR-026): a decision policy that does not
// hold its invariants. They never travel over HTTP: a rejected policy stops the server naming
// the field (ADR-024). Codes are the Problem Details slugs of the catalogue.
import { BARRIERS, DomainError } from "../shared-kernel/index.js";

const MODULE = "decision" as const;
/** The messages list the barriers from the kernel's catalogue, never by hand (015 F-022). */
const BARRIER_LIST = BARRIERS.join(", ");

export class InvalidPolicyVersion extends DomainError {
  readonly code = "invalid-policy-version" as const;
  readonly module = MODULE;
  constructor() {
    super("The decision policy version must be a non-empty string.", { path: "version" });
  }
}

export class InvalidPolicyThreshold extends DomainError {
  readonly code = "invalid-policy-threshold" as const;
  readonly module = MODULE;
  constructor() {
    super("The confidence threshold must be a number between 0 and 1.", { path: "threshold" });
  }
}

export class InvalidPolicyPriority extends DomainError {
  readonly code = "invalid-policy-priority" as const;
  readonly module = MODULE;
  constructor() {
    super(`The priority must list each barrier (${BARRIER_LIST}) exactly once.`, { path: "priority" });
  }
}

export class InvalidPolicyEvidence extends DomainError {
  readonly code = "invalid-policy-evidence" as const;
  readonly module = MODULE;
  constructor(field: string, barrier: string) {
    super(`"${barrier}" is not a barrier of the MVP (${BARRIER_LIST}).`, { path: `evidence.${field}` });
  }
}

/**
 * What the plane could not read (feature 032, FR-012). It is the **third** answer of the two state
 * stores, and it exists because the other two were about to become indistinguishable: once `load`
 * reads from a durable store, `undefined` would mean both "this visitor is new" and "the store did not
 * answer", and the system would treat a failure as a new visitor and hand them the whole quota.
 *
 * Its `code` is the same slug as the `NO_OP` reason the decision degrades to, because the two name the
 * same thing from the two sides: this is what the store says, that is what the SDK hears.
 *
 * Like the rest of this file it never travels over HTTP — the decision degrades rather than fail — and
 * it is in the catalogue anyway, which is the rule `entidad.md` fixes for every `DomainError`.
 */
export class StateUnavailable extends DomainError {
  readonly code = "state-unavailable" as const;
  readonly module = MODULE;
  constructor(what: "session" | "visitor") {
    super(`The ${what} state could not be read.`, { path: what });
  }
}

export type DecisionError =
  InvalidPolicyVersion | InvalidPolicyThreshold | InvalidPolicyPriority | InvalidPolicyEvidence;
