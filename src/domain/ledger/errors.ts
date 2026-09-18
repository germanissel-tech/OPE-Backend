// Business errors of the ledger module (ADR-023). Codes are the Problem Details slugs of
// contracts/problem-types.yaml; the replica test keeps both in step.
import { DomainError, type ModuleName } from "../shared-kernel/index.js";

const MODULE = "ledger" satisfies ModuleName;

/** The ledger could not accept a write (ADR-021): nothing recorded, the caller fails closed. */
export class LedgerUnavailable extends DomainError {
  readonly code = "ledger-unavailable" as const;
  readonly module = MODULE;
  constructor(message = "The ledger is not available: nothing was recorded.") {
    super(message);
  }
}

/** Nonexistent, foreign or with another session/visitor: the same answer, nothing revealed. */
export class ExposureDecisionUnknown extends DomainError {
  readonly code = "exposure-decision-unknown" as const;
  readonly module = MODULE;
  constructor() {
    super("The decision does not exist for this merchant, session and visitor.");
  }
}

export class ExposureOfNoOp extends DomainError {
  readonly code = "exposure-of-no-op" as const;
  readonly module = MODULE;
  constructor(decisionId: string) {
    super(`Decision ${decisionId} was NO_OP: there is no intervention to expose.`);
  }
}

export type LedgerError = LedgerUnavailable | ExposureDecisionUnknown | ExposureOfNoOp;
