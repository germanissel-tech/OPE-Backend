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
