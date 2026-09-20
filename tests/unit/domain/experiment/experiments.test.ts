// Feature 015 (F-007 of the audit 014; ADR-022, ADR-024): the experiments of a merchant have an
// owner — at most one active, identifiers unique — over experiments already built by their own
// factory; the configuration only translates.
import { describe, expect, it } from "vitest";
import {
  DuplicateExperimentId,
  Experiment,
  Experiments,
  MultipleActiveExperiments,
  type ExperimentRecord,
} from "../../../../src/domain/experiment/index.js";
import { asExperimentId, asMerchantId } from "../../../../src/domain/shared-kernel/index.js";

const record = (id: string, status: "active" | "closed" = "active"): ExperimentRecord => ({
  experimentId: asExperimentId(id),
  merchantId: asMerchantId("m_a"),
  treatmentShare: 0.5,
  seed: "seed-alpha",
  status,
  startedAt: new Date("2026-09-17T00:00:00.000Z"),
});
const experiment = (id: string, status: "active" | "closed" = "active"): Experiment =>
  Experiment.rehydrate(record(id, status));

describe("Experiments.of", () => {
  it("accepts none, one active, and several closed next to one active; active() answers the one", () => {
    expect(Experiments.of([]).ok).toBe(true);
    const built = Experiments.of([experiment("exp_00000001", "closed"), experiment("exp_00000002")]);
    if (!built.ok) throw new Error(built.error.message);
    expect(built.value.all()).toHaveLength(2);
    expect(built.value.active()?.experimentId).toBe("exp_00000002");
    const none = Experiments.of([experiment("exp_00000001", "closed")]);
    expect(none.ok && none.value.active()).toBeUndefined();
  });

  it("[invariant:multiple-active-experiments] two active experiments reject the set, naming the second", () => {
    const built = Experiments.of([experiment("exp_00000001"), experiment("exp_00000002")]);
    expect(built).toMatchObject({
      ok: false,
      error: { code: "multiple-active-experiments", module: "experiment", details: { index: 1 } },
    });
    if (!built.ok) expect(built.error).toBeInstanceOf(MultipleActiveExperiments);
  });

  it("[invariant:duplicate-experiment-id] two experiments with the same identifier reject the set, naming the second", () => {
    const built = Experiments.of([experiment("exp_00000001", "closed"), experiment("exp_00000001")]);
    expect(built).toMatchObject({
      ok: false,
      error: { code: "duplicate-experiment-id", details: { index: 1 } },
    });
    if (!built.ok) expect(built.error).toBeInstanceOf(DuplicateExperimentId);
  });

  it("rehydrate does not re-judge: two recorded active experiments come back as recorded", () => {
    const set = Experiments.rehydrate([experiment("exp_00000001"), experiment("exp_00000002")]);
    expect(set.all()).toHaveLength(2);
    expect(set.active()?.experimentId).toBe("exp_00000001");
  });
});
