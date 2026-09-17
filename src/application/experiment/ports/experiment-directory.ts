// Port: where experiments come from. Configuration in this feature; the store in 008.
import type { Experiment } from "../../../domain/experiment/index.js";
import type { MerchantId } from "../../../domain/shared-kernel/index.js";

export interface ExperimentDirectory {
  /** The active experiment of the merchant, or undefined when there is none. */
  activeFor(merchantId: MerchantId): Experiment | undefined;
}
