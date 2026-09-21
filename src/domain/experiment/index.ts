// Public API of the experiment module (domain): the experiment (which assigns and moves through
// calibration, activity and closure), the set of a merchant's experiments (at most one open)
// and the assignment.
export type { Assignment } from "./assignment.js";
export {
  DuplicateExperimentId,
  ExperimentAlreadyOpen,
  ExperimentNotFound,
  ExperimentNotOpen,
  InvalidExperimentCuts,
  InvalidSeed,
  InvalidTargetSample,
  InvalidTreatmentShare,
  TreatmentExceedsHoldout,
} from "./errors.js";
export { Experiments } from "./experiments.js";
export type { ExperimentError, ExperimentSetError } from "./errors.js";
export { Experiment } from "./experiment.js";
export type {
  ExperimentInput,
  ExperimentPhase,
  ExperimentRecord,
  ExperimentStatus,
  WindowRestart,
} from "./experiment.js";
