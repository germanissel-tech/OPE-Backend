// Business errors of the experiment module (ADR-023, ADR-024): the invariants of an experiment.
// They surface at configuration time (fail-closed start), never over HTTP.
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

/** Two experiments of the merchant share an identifier (`details.index` names the second). */
export class DuplicateExperimentId extends DomainError {
  readonly code = "duplicate-experiment-id" as const;
  readonly module = MODULE;
  constructor(index: number) {
    super("Two experiments of the merchant share an identifier.", { index });
  }
}

/** More than one experiment of the merchant is active (`details.index` names the second, ADR-022). */
export class MultipleActiveExperiments extends DomainError {
  readonly code = "multiple-active-experiments" as const;
  readonly module = MODULE;
  constructor(index: number) {
    super("A merchant may have at most one active experiment.", { index });
  }
}

export type ExperimentError =
  InvalidTreatmentShare | InvalidSeed | DuplicateExperimentId | MultipleActiveExperiments;
