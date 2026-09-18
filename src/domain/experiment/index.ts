// Public API of the experiment module (domain): the experiment (which assigns) and the assignment.
export type { Assignment } from "./assignment.js";
export { InvalidSeed, InvalidTreatmentShare } from "./errors.js";
export type { ExperimentError } from "./errors.js";
export { Experiment } from "./experiment.js";
export type { ExperimentRecord, ExperimentStatus } from "./experiment.js";
