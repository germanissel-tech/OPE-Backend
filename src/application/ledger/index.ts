// Public API of the ledger module (application).
export type { DecisionLedger, RecordResult } from "./ports/decision-ledger.js";
export type { ExposureLedger, ExposureRecordResult, ExposureRecordStatus } from "./ports/exposure-ledger.js";
export { ConfirmExposureUseCase } from "./use-cases/confirm-exposure.use-case.js";
export type {
  ConfirmExposureDependencies,
  ConfirmExposureRequest,
  ConfirmExposureResponse,
} from "./use-cases/confirm-exposure.use-case.js";
