// Experiments from the merchant configuration (local profile).
import { asExperimentId, asMerchantId, type MerchantId } from "../../../domain/shared-kernel/index.js";
import type { ExperimentDirectory } from "../../../application/experiment/index.js";
import type { Experiment } from "../../../domain/experiment/index.js";

export interface ExperimentRecord {
  experimentId: string;
  treatmentPercent: number;
  seed: string;
  status: "active" | "closed";
  startedAt: string;
}

export interface MerchantExperiments {
  merchantId: string;
  experiments: readonly ExperimentRecord[];
}

export function configExperimentDirectory(merchants: readonly MerchantExperiments[]): ExperimentDirectory {
  const active = new Map<MerchantId, Experiment>();
  for (const merchant of merchants) {
    const merchantId = asMerchantId(merchant.merchantId);
    const record = merchant.experiments.find((e) => e.status === "active");
    if (!record) continue;
    active.set(merchantId, {
      experimentId: asExperimentId(record.experimentId),
      merchantId,
      treatmentPercent: record.treatmentPercent,
      seed: record.seed,
      status: record.status,
      startedAt: new Date(record.startedAt),
    });
  }
  return { activeFor: (merchantId) => Promise.resolve(active.get(merchantId)) };
}
