// Experiment directory port: which experiment is open for a merchant (at most one — calibrating
// or active — ADR-022, 03 §4.10): the one that assigns visitors and under which OPE decides.
import type { Experiment } from "../../../domain/experiment/index.js";
import type { MerchantId } from "../../../domain/shared-kernel/index.js";

export interface ExperimentDirectory {
  /** The open experiment of the merchant, or undefined when there is none. */
  activeFor(merchantId: MerchantId): Promise<Experiment | undefined>;
}
