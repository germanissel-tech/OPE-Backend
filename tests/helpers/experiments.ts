// Experiments as the tests describe them (feature 017): a full record from a few facts, active
// by default — opened, activated and its window started at the same instant, like a seed.
import {
  Experiment,
  type ExperimentRecord,
  type ExperimentStatus,
} from "../../src/domain/experiment/index.js";
import { asExperimentId, asMerchantId } from "../../src/domain/shared-kernel/index.js";

/** The target sample the test experiments aim at when the test does not care. */
export const TEST_TARGET_SAMPLE = 1000;

export interface ExperimentFacts {
  experimentId?: string;
  merchantId?: string;
  treatmentShare?: number;
  seed?: string;
  status?: ExperimentStatus;
  openedAt?: Date;
  targetSample?: number;
  cuts?: readonly number[];
}

/** A record in the given status as of `openedAt`: the instants a transition sets follow the status. */
export function experimentRecord(facts: ExperimentFacts = {}): ExperimentRecord {
  const status = facts.status ?? "active";
  const openedAt = facts.openedAt ?? new Date("2026-09-17T00:00:00.000Z");
  return {
    experimentId: asExperimentId(facts.experimentId ?? "exp_00000001"),
    merchantId: asMerchantId(facts.merchantId ?? "m_a"),
    treatmentShare: facts.treatmentShare ?? 0.5,
    seed: facts.seed ?? "seed-alpha",
    targetSample: facts.targetSample ?? TEST_TARGET_SAMPLE,
    cuts: facts.cuts ?? [],
    status,
    openedAt,
    ...(status === "calibrating" ? {} : { activatedAt: openedAt, windowStartedAt: openedAt }),
    ...(status === "closed" ? { closedAt: openedAt } : {}),
    windowRestarts: [],
  };
}

export const testExperiment = (facts: ExperimentFacts = {}): Experiment =>
  Experiment.rehydrate(experimentRecord(facts));
