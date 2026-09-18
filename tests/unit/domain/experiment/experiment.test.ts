// ADR-024: an Experiment only exists valid; rehydrate trusts recorded facts.
import { describe, expect, it } from "vitest";
import {
  Experiment,
  InvalidSeed,
  InvalidTreatmentShare,
  type ExperimentRecord,
} from "../../../../src/domain/experiment/index.js";
import { asExperimentId, asMerchantId } from "../../../../src/domain/shared-kernel/index.js";

const record = (over: Partial<ExperimentRecord> = {}): ExperimentRecord => ({
  experimentId: asExperimentId("exp_00000001"),
  merchantId: asMerchantId("m_a"),
  treatmentShare: 0.5,
  seed: "seed-alpha",
  status: "active",
  startedAt: new Date("2026-09-17T00:00:00.000Z"),
  ...over,
});

describe("Experiment.of", () => {
  it("accepts shares 0, 0.5 and 1 and keeps every field", () => {
    for (const treatmentShare of [0, 0.5, 1]) {
      const built = Experiment.of(record({ treatmentShare }));
      expect(built.ok).toBe(true);
      if (built.ok) expect(built.value).toMatchObject(record({ treatmentShare }));
    }
  });

  it.each([-0.1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "[invariant] share %s is rejected",
    (treatmentShare) => {
      const built = Experiment.of(record({ treatmentShare }));
      expect(built).toMatchObject({
        ok: false,
        error: { code: "invalid-treatment-share", module: "experiment", details: { share: treatmentShare } },
      });
      if (!built.ok) expect(built.error).toBeInstanceOf(InvalidTreatmentShare);
    },
  );

  it("[invariant] an empty seed is rejected", () => {
    const built = Experiment.of(record({ seed: "" }));
    expect(built).toMatchObject({ ok: false, error: { code: "invalid-seed" } });
    if (!built.ok) expect(built.error).toBeInstanceOf(InvalidSeed);
  });

  it("rehydrate does not re-judge: a recorded share out of range comes back as recorded", () => {
    expect(Experiment.rehydrate(record({ treatmentShare: 2 })).treatmentShare).toBe(2);
  });

  it("isActive follows the status", () => {
    expect(Experiment.rehydrate(record()).isActive()).toBe(true);
    expect(Experiment.rehydrate(record({ status: "closed" })).isActive()).toBe(false);
  });
});
