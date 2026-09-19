// Public API of the experiment module (domain): the experiment (which assigns), the set of a
// merchant's experiments (at most one active) and the assignment.
export type { Assignment } from "./assignment.js";
export {
  DuplicateExperimentId,
  InvalidSeed,
  InvalidTreatmentShare,
  MultipleActiveExperiments,
} from "./errors.js";
export { Experiments } from "./experiments.js";
export type { ExperimentError } from "./errors.js";
export { Experiment } from "./experiment.js";
export type { ExperimentRecord, ExperimentStatus } from "./experiment.js";
