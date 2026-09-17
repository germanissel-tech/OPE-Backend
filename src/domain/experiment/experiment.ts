// Experiment (01-arquitectura-mvp.md §4.1, §14.2; ADR-022): one per merchant may be active. Seed
// and split are immutable: changing them is a new experiment with another identifier. The
// assignment is not a feature flag: nobody changes a visitor's arm.
import type { ExperimentId, MerchantId } from "../shared-kernel/index.js";

export type ExperimentStatus = "active" | "closed";

export interface Experiment {
  experimentId: ExperimentId;
  merchantId: MerchantId;
  /** Share of visitors assigned to TREATMENT, as an integer percentage 0..100. */
  treatmentPercent: number;
  /** Part of the assignment key; immutable. */
  seed: string;
  status: ExperimentStatus;
  startedAt: Date;
}

/** The active experiment of a list (at most one; configuration enforces it). */
export function activeExperiment(experiments: readonly Experiment[]): Experiment | undefined {
  return experiments.find((e) => e.status === "active");
}
