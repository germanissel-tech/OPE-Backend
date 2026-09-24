// Feature 007, US1 (FR-002..FR-005, SC-001; constitution III; ADR-022): the assignment is deterministic,
// stable, splits as configured and is independent between merchants and experiments.
import { describe, expect, it } from "vitest";
import { asVisitorId } from "../../../../src/domain/shared-kernel/index.js";
import { testExperiment, type ExperimentFacts } from "../../../helpers/experiments.js";
import type { Experiment } from "../../../../src/domain/experiment/index.js";

const SAMPLE = 100_000;
/** The observed split may sit this far from the declared one: a hundredth, in shares. */
const TOLERANCE = 0.01;

const experiment = (over: ExperimentFacts & { treatmentShare?: number } = {}): Experiment => {
  const { treatmentShare, ...rest } = over;
  return testExperiment({ treatmentShare: treatmentShare ?? 0.5, ...rest });
};

// Sequential ids are the adversarial case for a hash-based split (research R-01).
const visitor = (n: number) => asVisitorId(`vis_${String(n).padStart(8, "0")}`);

/** The share of the sample the experiment assigned to TREATMENT: measured, not declared. */
function observedShare(exp: Experiment): number {
  let treatment = 0;
  for (let n = 0; n < SAMPLE; n += 1) if (exp.assign(visitor(n)) === "TREATMENT") treatment += 1;
  return treatment / SAMPLE;
}

describe("Experiment.assign", () => {
  it("determinism: the same input gives the same arm a thousand times", () => {
    const exp = experiment();
    const first = exp.assign(visitor(42));
    for (let i = 0; i < 1000; i += 1) expect(exp.assign(visitor(42))).toBe(first);
  });

  it.each([0.5, 0.2, 0.8])("split: 100 000 sequential visitors land within a hundredth of %d", (declared) => {
    const observed = observedShare(experiment({ treatmentShare: declared }));
    expect(Math.abs(observed - declared)).toBeLessThanOrEqual(TOLERANCE);
  });

  it("edges: a share of 0 never assigns TREATMENT and a share of 1 always does", () => {
    expect(observedShare(experiment({ treatmentShare: 0 }))).toBe(0);
    expect(observedShare(experiment({ treatmentShare: 1 }))).toBe(1);
  });

  // Feature 022: this is the case the whole feature exists for. When the split was a percentage
  // read as a share, a `1` meant one percent on one side of the conversion and everything on the
  // other, and nothing could tell the two apart. Now `0.01` is one hundredth and `1` is everyone,
  // and the distance between them is a hundred times the sample.
  it("a split of 0.01 gives the treatment one percent of the visitors, not all of them", () => {
    const observed = observedShare(experiment({ treatmentShare: 0.01 }));
    expect(observed).toBeGreaterThan(0);
    expect(observed).toBeLessThan(0.02);
    expect(observedShare(experiment({ treatmentShare: 1 })) / observed).toBeGreaterThan(50);
  });

  it("independence: the same visitor in two merchants agrees only as often as chance (45–55 %)", () => {
    const a = experiment();
    const b = experiment({ merchantId: "m_b", seed: "seed-beta" });
    let agree = 0;
    for (let n = 0; n < SAMPLE; n += 1) if (a.assign(visitor(n)) === b.assign(visitor(n))) agree += 1;
    const share = (100 * agree) / SAMPLE;
    expect(share).toBeGreaterThan(45);
    expect(share).toBeLessThan(55);
  });

  it("stability: another seed or another experimentId reshuffles about half of the visitors", () => {
    const base = experiment();
    for (const other of [experiment({ seed: "seed-gamma" }), experiment({ experimentId: "exp_00000002" })]) {
      let changed = 0;
      for (let n = 0; n < SAMPLE; n += 1)
        if (base.assign(visitor(n)) !== other.assign(visitor(n))) changed += 1;
      const share = (100 * changed) / SAMPLE;
      expect(share).toBeGreaterThan(45);
      expect(share).toBeLessThan(55);
    }
  });
});
