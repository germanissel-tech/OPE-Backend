// Public API of the experiment module (application).
export type { AssignmentLedger, AssignmentRecordResult } from "./ports/assignment-ledger.js";
export type { ExperimentDirectory } from "./ports/experiment-directory.js";
export { DefaultAssignmentService } from "./services/assignment.service.js";
export type {
  AssignmentResult,
  AssignmentService,
  AssignmentServiceDependencies,
} from "./services/assignment.service.js";
