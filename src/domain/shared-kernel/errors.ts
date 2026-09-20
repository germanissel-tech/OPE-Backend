// Root of every business error (ADR-023). A business error is a value that use cases return
// inside a Result, never something they throw: `throw` is for programming errors. Each module
// declares its own errors in `domain/<module>/errors.ts` with literal `code` and `module`, so a
// consumer knows by type what can fail and the HTTP adapter translates by `code` alone.

/** Data safe to expose and log: scalars only, never a visitor, session or any personal datum. */
export type SafeDetails = Readonly<Record<string, string | number | boolean>>;

export abstract class DomainError extends Error {
  /** Stable slug; the Problem Details `type` without its prefix. Unique across modules. */
  abstract readonly code: string;
  /** The module that emits it: the folder of its `errors.ts`, as `ope/domain-error-shape` verifies. */
  abstract readonly module: string;
  readonly details: SafeDetails;

  constructor(message: string, details: SafeDetails = {}) {
    super(message);
    this.name = new.target.name;
    this.details = details;
  }
}

const MODULE = "shared-kernel" as const;

/** A monetary amount or currency that does not have the shape the contract publishes (ADR-014). */
export class InvalidMoney extends DomainError {
  readonly code = "invalid-money" as const;
  readonly module = MODULE;
  constructor(field: "amount" | "currency") {
    super("Money needs a decimal amount with up to two decimals and an ISO 4217 currency.", { field });
  }
}

/** Same identity, different content (ADR-020): a repeated notification whose key matches a record with other content. */
export class IdempotencyConflict extends DomainError {
  readonly code = "idempotency-conflict" as const;
  readonly module = MODULE;
  constructor(what: string) {
    super(`${what} already exists with different content.`);
  }
}

/** A store of the platform (merchants, configuration, experiments, admin log) did not answer: nothing was written (ADR-031). */
export class StoreUnavailable extends DomainError {
  readonly code = "store-unavailable" as const;
  readonly module = MODULE;
  constructor(message = "The store is not available: nothing was written.") {
    super(message);
  }
}

export type SharedKernelError = InvalidMoney | IdempotencyConflict | StoreUnavailable;
