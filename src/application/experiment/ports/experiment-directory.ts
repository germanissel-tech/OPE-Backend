// Experiment directory port: which experiment is active for a merchant (at most one, ADR-022).
import type { Experiment } from "../../../domain/experiment/index.js";
import type { MerchantId } from "../../../domain/shared-kernel/index.js";

export interface ExperimentDirectory {
  /** The active experiment of the merchant, or undefined when there is none. */
  activeFor(merchantId: MerchantId): Promise<Experiment | undefined>;
}
