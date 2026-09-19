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

export type DecisionError =
  InvalidPolicyVersion | InvalidPolicyThreshold | InvalidPolicyPriority | InvalidPolicyEvidence;
