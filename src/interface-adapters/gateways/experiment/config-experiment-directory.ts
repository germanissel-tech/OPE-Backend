// Experiment directory over the configured experiments (local profile): the active one per
// merchant, resolved once at start.
import type { ExperimentDirectory } from "../../../application/experiment/index.js";
import type { Experiment } from "../../../domain/experiment/index.js";
import type { MerchantId } from "../../../domain/shared-kernel/index.js";

export interface MerchantExperiments {
  merchantId: MerchantId;
  experiments: readonly Experiment[];
}

export function configExperimentDirectory(merchants: readonly MerchantExperiments[]): ExperimentDirectory {
  const active = new Map<MerchantId, Experiment>();
  for (const { merchantId, experiments } of merchants) {
    const experiment = experiments.find((e) => e.isActive());
    if (experiment) active.set(merchantId, experiment);
  }
  return { activeFor: (merchantId) => Promise.resolve(active.get(merchantId)) };
}
