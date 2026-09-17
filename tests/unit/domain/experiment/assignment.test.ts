// US1 (FR-002..FR-005, SC-001; constitution III; ADR-022): the assignment is deterministic,
// stable, splits as configured and is independent between merchants and experiments.
import { describe, expect, it } from "vitest";
import {
  activeExperiment,
  assignArm,
  assignmentKey,
  fnv1a32,
  type Experiment,
} from "../../../../src/domain/experiment/index.js";
import { asExperimentId, asMerchantId, asVisitorId } from "../../../../src/domain/shared-kernel/index.js";

const SAMPLE = 100_000;
const TOLERANCE_PP = 1;

const experiment = (over: Partial<Experiment> = {}): Experiment => ({
  experimentId: asExperimentId("exp_00000001"),
  merchantId: asMerchantId("m_a"),
  treatmentPercent: 50,
  seed: "seed-alpha",
  status: "active",
  startedAt: new Date("2026-09-17T00:00:00.000Z"),
  ...over,
});

// Sequential ids are the adversarial case for a hash-based split (research R-01).
const visitor = (n: number) => asVisitorId(`vis_${String(n).padStart(8, "0")}`);

function treatmentShare(exp: Experiment): number {
  let treatment = 0;
  for (let n = 0; n < SAMPLE; n += 1) if (assignArm(exp, visitor(n)) === "TREATMENT") treatment += 1;
  return (100 * treatment) / SAMPLE;
}

describe("assignArm", () => {
  it("determinism: the same input gives the same arm a thousand times", () => {
    const exp = experiment();
    const first = assignArm(exp, visitor(42));
    for (let i = 0; i < 1000; i += 1) expect(assignArm(exp, visitor(42))).toBe(first);
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
    const b = experiment({ merchantId: asMerchantId("m_b"), seed: "seed-beta" });
    let agree = 0;
    for (let n = 0; n < SAMPLE; n += 1) if (assignArm(a, visitor(n)) === assignArm(b, visitor(n))) agree += 1;
    const share = (100 * agree) / SAMPLE;
    expect(share).toBeGreaterThan(45);
    expect(share).toBeLessThan(55);
  });

  it("stability: another seed or another experimentId reshuffles about half of the visitors", () => {
    const base = experiment();
    for (const other of [
      experiment({ seed: "seed-gamma" }),
      experiment({ experimentId: asExperimentId("exp_00000002") }),
    ]) {
      let changed = 0;
      for (let n = 0; n < SAMPLE; n += 1)
        if (assignArm(base, visitor(n)) !== assignArm(other, visitor(n))) changed += 1;
      const share = (100 * changed) / SAMPLE;
      expect(share).toBeGreaterThan(45);
      expect(share).toBeLessThan(55);
    }
  });

  it("the key separates the fields with the unit separator so none can imitate another", () => {
    expect(assignmentKey(experiment(), visitor(1))).toBe("m_aexp_00000001seed-alphavis_00000001");
  });
});

describe("fnv1a32", () => {
  it("matches the reference vectors of FNV-1a 32", () => {
    expect(fnv1a32("")).toBe(0x811c9dc5);
    expect(fnv1a32("a")).toBe(0xe40c292c);
    expect(fnv1a32("foobar")).toBe(0xbf9cf968);
  });
});

describe("activeExperiment", () => {
  it("returns the active one and undefined when there is none", () => {
    const closed = experiment({ experimentId: asExperimentId("exp_00000009"), status: "closed" });
    const active = experiment();
    expect(activeExperiment([closed, active])).toBe(active);
    expect(activeExperiment([closed])).toBeUndefined();
    expect(activeExperiment([])).toBeUndefined();
  });
});
