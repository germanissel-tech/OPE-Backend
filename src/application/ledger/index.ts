// Public API of the ledger module (application).
export { makeConfirmExposure } from "./confirm-exposure.js";
export type {
  ConfirmExposure,
  ConfirmExposureDeps,
  ConfirmExposureInput,
  ConfirmExposureResult,
  ExposureInvariant,
} from "./confirm-exposure.js";
export type { DecisionLedger } from "./ports/decision-ledger.js";
export type { ExposureLedger, ExposureRecordStatus } from "./ports/exposure-ledger.js";
