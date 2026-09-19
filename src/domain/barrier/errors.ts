// Business errors of the barrier module (ADR-023, ADR-026): a set of rules that does not hold
// its invariants. They never travel over HTTP: a rejected policy stops the server naming the
// field (ADR-024), like a rejected experiment. Codes are the Problem Details slugs of the catalogue.
import { DomainError } from "../shared-kernel/index.js";

const MODULE = "barrier" as const;

export class InvalidRuleWeight extends DomainError {
  readonly code = "invalid-rule-weight" as const;
  readonly module = MODULE;
  constructor(path: string, index?: number) {
    super(`${path} must be a number between 0 and 1.`, index === undefined ? { path } : { path, index });
  }
}

export class InvalidRuleThreshold extends DomainError {
  readonly code = "invalid-rule-threshold" as const;
  readonly module = MODULE;
  constructor(path: string, index?: number) {
    super(`${path} must be a non-negative number.`, index === undefined ? { path } : { path, index });
  }
}

export class DuplicateRuleId extends DomainError {
  readonly code = "duplicate-rule-id" as const;
  readonly module = MODULE;
  constructor(id: string, index: number) {
    super(id === "" ? "A rule id is empty." : `Rule id "${id}" is declared twice.`, { path: "id", index });
  }
}

export class UnknownBarrier extends DomainError {
  readonly code = "unknown-barrier" as const;
  readonly module = MODULE;
  constructor(barrier: string, index: number) {
    super(`"${barrier}" is not a barrier of the MVP (fit, price, returns).`, { path: "barrier", index });
  }
}

/** A condition names an event type, subtype or block OPE does not capture (`path` locates it inside `when`). */
export class UnknownFact extends DomainError {
  readonly code = "unknown-fact" as const;
  readonly module = MODULE;
  constructor(path: string, what: string, index?: number) {
    super(
      `${path}: "${what}" is not in the vocabulary OPE captures.`,
      index === undefined ? { path } : { path, index },
    );
  }
}

export class BarrierWithoutRules extends DomainError {
  readonly code = "barrier-without-rules" as const;
  readonly module = MODULE;
  constructor(barrier: string) {
    super(`Barrier "${barrier}" has no rule; every barrier needs at least one.`, { path: "rules" });
  }
}

export type BarrierError =
  | InvalidRuleWeight
  | InvalidRuleThreshold
  | DuplicateRuleId
  | UnknownBarrier
  | UnknownFact
  | BarrierWithoutRules;
