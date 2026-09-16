// Eval fixture: stub controller.
import type { ConfirmExposure } from "../../../../application/ledger/index.js";
export function makeConfirmExposureHandler(confirmExposure: ConfirmExposure): () => Promise<unknown> {
  return () => confirmExposure();
}
