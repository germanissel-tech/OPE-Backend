// Feature 007, US1 (FR-002..FR-005, SC-001; constitution III; ADR-022): the assignment is deterministic,
// stable, splits as configured and is independent between merchants and experiments.
import { describe, expect, it } from "vitest";
import { asVisitorId } from "../../../../src/domain/shared-kernel/index.js";
import { testExperiment, type ExperimentFacts } from "../../../helpers/experiments.js";
import type { Experiment } from "../../../../src/domain/experiment/index.js";

const SAMPLE = 100_000;
const TOLERANCE_PP = 1;

const PERCENT = 100;

const experiment = (over: ExperimentFacts & { treatmentPercent?: number } = {}): Experiment => {
  const { treatmentPercent, ...rest } = over;
  return testExperiment({ treatmentShare: (treatmentPercent ?? 50) / PERCENT, ...rest });
};

// Sequential ids are the adversarial case for a hash-based split (research R-01).
const visitor = (n: number) => asVisitorId(`vis_${String(n).padStart(8, "0")}`);

function treatmentShare(exp: Experiment): number {
  let treatment = 0;
  for (let n = 0; n < SAMPLE; n += 1) if (exp.assign(visitor(n)) === "TREATMENT") treatment += 1;
  return (100 * treatment) / SAMPLE;
}

describe("Experiment.assign", () => {
  it("determinism: the same input gives the same arm a thousand times", () => {
    const exp = experiment();
    const first = exp.assign(visitor(42));
    for (let i = 0; i < 1000; i += 1) expect(exp.assign(visitor(42))).toBe(first);
  });

  it.each([50, 20, 80])("split: 100 000 sequential visitors land within ±1 pp of %i %", (percent) => {
    const share = treatmentShare(experiment({ treatmentPercent: percent }));
    expect(Math.abs(share - percent)).toBeLessThanOrEqual(TOLERANCE_PP);
  });

  it("edges: 0 % never assigns TREATMENT and 100 % always does", () => {
    expect(treatmentShare(experiment({ treatmentPercent: 0 }))).toBe(0);
    expect(treatmentShare(experiment({ treatmentPercent: 100 }))).toBe(100);
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
