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

export type ExperimentError = InvalidTreatmentShare | InvalidSeed;
