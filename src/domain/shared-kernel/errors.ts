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
  /**
   * How an administration entry records this error when it is the reason an action did not
   * happen. Only an error that **denies** says so; anything else is a rejection, which is the
   * conservative reading. The kernel used to decide this by comparing the code against a literal
   * of another module it cannot even import — so now the owner of the rule declares it.
   */
  readonly audit: "denied" | undefined = undefined;
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

/**
 * A publication of treatment —a configuration version or a text— while an experiment is active: only a
 * corrective one, with its reason, is accepted (03 §4.10, D-G). It lives in the kernel since feature 038
 * because two modules that cannot depend on each other publish treatment, and a code is one class.
 */
export class ConfigurationFrozen extends DomainError {
  readonly code = "configuration-frozen" as const;
  readonly module = MODULE;
  constructor() {
    super(
      "The configuration is frozen while an experiment is active: only a corrective version is accepted.",
    );
  }
}

/** A corrective publication carries its reason; without one there is nothing to record in the window it restarts. */
export class ConfigurationReasonRequired extends DomainError {
  readonly code = "configuration-reason-required" as const;
  readonly module = MODULE;
  constructor() {
    super("A corrective configuration version needs a reason.", { pointer: "reason" });
  }
}

/**
 * A language with no complete base (feature 038): it cannot be supported, named as reserve, or left by the
 * seed. It lives in the kernel because the seed of the texts and the publications of languages —two modules
 * that cannot depend on each other— refuse with it. The families it lacks travel in the details as one
 * string, which is what an operator needs to complete it (the details of an error are scalars); `pointer`
 * says where the language was declared, when it was declared in a request.
 */
export class LocaleIncomplete extends DomainError {
  readonly code = "locale-incomplete" as const;
  readonly module = MODULE;
  constructor(locale: string, missing: string, pointer: string | undefined) {
    super("The base layer has no text for some families in that language.", {
      locale,
      missing,
      problem: `${locale}: ${missing}`,
      ...(pointer === undefined ? {} : { pointer }),
    });
  }
}

/**
 * A write that replaces what it read, with the witness of a version that is no longer the one there (feature
 * 043, ADR-046): somebody wrote the resource in between, or the witness is another resource's. Nothing was
 * written. It carries no details on purpose: the current witness does not travel in the refusal, because
 * handing it out invites sending it back without looking at what the other one wrote.
 *
 * In the kernel because two modules that cannot depend on each other answer it: the configuration and the
 * merchants.
 */
export class StaleVersion extends DomainError {
  readonly code = "stale-version" as const;
  readonly module = MODULE;
  constructor() {
    super("The resource changed since it was read.");
  }
}

export type SharedKernelError =
  | InvalidMoney
  | IdempotencyConflict
  | StoreUnavailable
  | ConfigurationFrozen
  | ConfigurationReasonRequired
  | LocaleIncomplete
  | StaleVersion;
