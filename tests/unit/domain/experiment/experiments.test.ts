// Feature 015 (F-007 of the audit 014; ADR-022, ADR-024) and 017 US3 (03 §4.10): the experiments
// of a merchant have an owner — at most one open (calibrating or active), identifiers unique —
// over experiments already built by their own factory; the configuration only translates.
import { describe, expect, it } from "vitest";
import {
  DuplicateExperimentId,
  ExperimentAlreadyOpen,
  Experiments,
  type Experiment,
  type ExperimentStatus,
} from "../../../../src/domain/experiment/index.js";
import { testExperiment } from "../../../helpers/experiments.js";

const experiment = (experimentId: string, status: ExperimentStatus = "active"): Experiment =>
  testExperiment({ experimentId, status });

describe("Experiments.of", () => {
  it("accepts none, one open, and several closed next to one open; open() answers the one", () => {
    expect(Experiments.of([]).ok).toBe(true);
    const built = Experiments.of([experiment("exp_00000001", "closed"), experiment("exp_00000002")]);
    if (!built.ok) throw new Error(built.error.message);
    expect(built.value.all()).toHaveLength(2);
    expect(built.value.open()?.experimentId).toBe("exp_00000002");
    const calibrating = Experiments.of([
      experiment("exp_00000001", "closed"),
      experiment("exp_00000002", "calibrating"),
    ]);
    expect(calibrating.ok && calibrating.value.open()?.experimentId).toBe("exp_00000002");
    const none = Experiments.of([experiment("exp_00000001", "closed")]);
    expect(none.ok && none.value.open()).toBeUndefined();
  });

  it("[invariant:experiment-already-open] two open experiments — active or calibrating — reject the set, naming the second", () => {
    const pairs: [ExperimentStatus, ExperimentStatus][] = [
      ["active", "active"],
      ["active", "calibrating"],
      ["calibrating", "active"],
      ["calibrating", "calibrating"],
    ];
    for (const [first, second] of pairs) {
      const built = Experiments.of([experiment("exp_00000001", first), experiment("exp_00000002", second)]);
      expect(built, `${first} + ${second}`).toMatchObject({
        ok: false,
        error: { code: "experiment-already-open", module: "experiment", details: { index: 1 } },
      });
      if (!built.ok) expect(built.error).toBeInstanceOf(ExperimentAlreadyOpen);
    }
  });

  it("[invariant:duplicate-experiment-id] two experiments with the same identifier reject the set, naming the second", () => {
    const built = Experiments.of([experiment("exp_00000001", "closed"), experiment("exp_00000001")]);
    expect(built).toMatchObject({
      ok: false,
      error: { code: "duplicate-experiment-id", details: { index: 1 } },
    });
    if (!built.ok) expect(built.error).toBeInstanceOf(DuplicateExperimentId);
  });

  it("rehydrate does not re-judge: two recorded open experiments come back as recorded", () => {
    const set = Experiments.rehydrate([experiment("exp_00000001"), experiment("exp_00000002")]);
    expect(set.all()).toHaveLength(2);
    expect(set.open()?.experimentId).toBe("exp_00000001");
  });
});
