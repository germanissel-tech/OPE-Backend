import { DomainError } from "../shared-kernel/index.js";

const MODULE = "experiment" as const;

export class InvalidTreatmentShare extends DomainError {
  readonly code = "invalid-treatment-share" as const;
  readonly module = MODULE;
  constructor(share: number) {
    super("The treatment share must be a number between 0 and 1.", { share });
  }
}

export class InvalidSeed extends DomainError {
  readonly code = "invalid-seed" as const;
  readonly module = MODULE;
  constructor() {
    super("The seed must be a non-empty string.");
  }
}

/** The target sample is not a whole number of at least one visitor. */
export class InvalidTargetSample extends DomainError {
  readonly code = "invalid-target-sample" as const;
  readonly module = MODULE;
  constructor(targetSample: number) {
    super("The target sample must be an integer of at least 1.", { targetSample });
  }
}

/** The cuts are not strictly increasing fractions of the target sample (D-F). */
export class InvalidExperimentCuts extends DomainError {
  readonly code = "invalid-experiment-cuts" as const;
  readonly module = MODULE;
  constructor(index: number) {
    super("The cuts must be strictly increasing fractions of the target sample.", { index });
  }
}

/**
 * The share is finer than the split can hand out, so the split that ran would not be the one that
 * was declared: `0.004` would assign nobody (ADR-035). Distinct from `InvalidTreatmentShare`, which
 * is the range: `0.075` is perfectly in range.
 */
export class TreatmentShareTooFine extends DomainError {
  readonly code = "treatment-share-too-fine" as const;
  readonly module = MODULE;
  constructor(share: number) {
    super("The treatment share must be one of the buckets the assignment splits the visitors into.", {
      share,
    });
  }
}

/** The split takes what the holdout of the merchant keeps out of OPE (feature 017). */
export class TreatmentExceedsHoldout extends DomainError {
  readonly code = "treatment-exceeds-holdout" as const;
  readonly module = MODULE;
  constructor(treatmentShare: number, holdoutShare: number) {
    super("The treatment share must leave the holdout of the merchant out.", {
      treatmentShare,
      holdoutShare,
    });
  }
}

/** Two experiments of the merchant share an identifier (`details.index` names the second). */
export class DuplicateExperimentId extends DomainError {
  readonly code = "duplicate-experiment-id" as const;
  readonly module = MODULE;
  constructor(index: number) {
    super("Two experiments of the merchant share an identifier.", { index });
  }
}

/** More than one experiment of the merchant is open (`details.index` names the second; ADR-022). */
export class ExperimentAlreadyOpen extends DomainError {
  readonly code = "experiment-already-open" as const;
  readonly module = MODULE;
  constructor(index: number) {
    super("A merchant may have at most one open experiment.", { index });
  }
}

/** The experiment is closed: the transition does not exist (03 §4.10). */
export class ExperimentNotOpen extends DomainError {
  readonly code = "experiment-not-open" as const;
  readonly module = MODULE;
  constructor() {
    super("The experiment is closed and cannot be activated nor reopened.");
  }
}

export class ExperimentNotFound extends DomainError {
  readonly code = "experiment-not-found" as const;
  readonly module = MODULE;
  constructor() {
    super("The experiment does not exist.");
  }
}

/** What opening an experiment can violate. */
export type ExperimentError =
  InvalidTreatmentShare | TreatmentShareTooFine | InvalidSeed | InvalidTargetSample | InvalidExperimentCuts;

/** What the set of a merchant's experiments can violate. */
export type ExperimentSetError = DuplicateExperimentId | ExperimentAlreadyOpen;
