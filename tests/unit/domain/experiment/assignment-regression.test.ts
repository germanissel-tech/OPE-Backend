// FR-041 (ADR-024): the assignment is bit for bit the one of feature 007. The fingerprints were
// computed on 2026-09-18 with the code before the refactor (assignArm + fnv1a32 of the arm
// sequence, "T"/"C", of 100 000 sequential visitors); any change to the key, the hash or the
// split rule changes them.
import { describe, expect, it } from "vitest";
import { asVisitorId } from "../../../../src/domain/shared-kernel/index.js";
import { testExperiment } from "../../../helpers/experiments.js";

const SAMPLE = 100_000;
const PERCENT = 100;
const FINGERPRINTS: Record<number, number> = { 50: 1243557091, 20: 853083737, 80: 2325495260 };

// Local copy of the domain's FNV-1a (src/domain/experiment/experiment.ts): the domain does not
// export it (feature 009) and the fingerprint must not move with the code it checks.
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
function fnv1a32(text: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash >>> 0;
}

describe("assignment regression against feature 007", () => {
  it.each(Object.entries(FINGERPRINTS))(
    "%s % treatment: the arm sequence of 100 000 visitors is unchanged",
    (percent, fingerprint) => {
      const experiment = testExperiment({ treatmentShare: Number(percent) / PERCENT, openedAt: new Date(0) });
      let arms = "";
      for (let n = 1; n <= SAMPLE; n += 1) {
        arms +=
          experiment.assign(asVisitorId(`vis_${String(n).padStart(8, "0")}`)) === "TREATMENT" ? "T" : "C";
      }
      expect(fnv1a32(arms)).toBe(fingerprint);
    },
  );

  it("every integer percentage survives the round trip to a rate once rounded to buckets (7 / 100 * 100 is not 7)", () => {
    const inexact: number[] = [];
    for (let percent = 0; percent <= PERCENT; percent += 1) {
      if ((percent / PERCENT) * PERCENT !== percent) inexact.push(percent);
      expect(Math.round((percent / PERCENT) * PERCENT)).toBe(percent);
    }
    expect(inexact.length).toBeGreaterThan(0);
  });

  it("the threshold is the rounded bucket count for every integer percentage", () => {
    for (let percent = 0; percent <= PERCENT; percent += 1) {
      const experiment = testExperiment({ treatmentShare: percent / PERCENT, openedAt: new Date(0) });
      // 10 000 sequential visitors: the share of TREATMENT lands within 2 pp of the percentage.
      let treatment = 0;
      for (let n = 1; n <= 10_000; n += 1) {
        if (experiment.assign(asVisitorId(`vis_${String(n).padStart(8, "0")}`)) === "TREATMENT")
          treatment += 1;
      }
      expect(Math.abs(treatment / 100 - percent)).toBeLessThanOrEqual(2);
    }
  });
});
