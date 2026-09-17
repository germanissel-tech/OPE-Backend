// Public API of the experiment module (domain): experiments, arms and the assignment function.
export { activeExperiment } from "./experiment.js";
export type { Experiment, ExperimentStatus } from "./experiment.js";
export { assignArm, assignmentKey, fnv1a32 } from "./assignment.js";
export type { Assignment } from "./assignment.js";
