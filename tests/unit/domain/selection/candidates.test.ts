// Feature 012 (FR-010, FR-011): the candidate catalogue is a closed, well-formed vocabulary.
import { describe, expect, it } from "vitest";
import { CANDIDATES, STEPS } from "../../../../src/domain/selection/index.js";
import { ANCHORS, BARRIERS } from "../../../../src/domain/shared-kernel/index.js";

const all = BARRIERS.flatMap((barrier) => CANDIDATES[barrier]);

describe("CANDIDATES", () => {
  it("every barrier has candidates, each of its own barrier, with ids that carry barrier, anchor and step", () => {
    for (const barrier of BARRIERS) {
      expect(CANDIDATES[barrier].length).toBeGreaterThan(0);
      for (const c of CANDIDATES[barrier]) {
        expect(c.barrier).toBe(barrier);
        expect(ANCHORS).toContain(c.anchor);
        expect(c.candidateId).toBe(`msg_${barrier}_${c.anchor}_${c.step}_v0`);
      }
    }
  });

  it("ids are unique and every list is ordered by the ladder", () => {
    expect(new Set(all.map((c) => c.candidateId)).size).toBe(all.length);
    for (const barrier of BARRIERS) {
      const indexes = CANDIDATES[barrier].map((c) => STEPS.indexOf(c.step));
      expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);
    }
  });

  it("the incentive claim exists only for the price barrier, and no candidate repeats a claim", () => {
    for (const c of all) {
      const kinds = c.claims.map((claim) => claim.kind);
      if (kinds.includes("incentive")) expect(c.barrier).toBe("price");
      expect(new Set(kinds).size).toBe(kinds.length);
    }
  });

  it("the lowest step of every barrier makes no claim: the safest general truth is always a candidate", () => {
    for (const barrier of BARRIERS) expect(CANDIDATES[barrier][0]?.claims).toEqual([]);
  });

  it("declares the claims of the MVP catalogue (spec 012, Assumptions)", () => {
    const claims = Object.fromEntries(all.map((c) => [c.candidateId, c.claims.map((claim) => claim.kind)]));
    expect(claims).toEqual({
      msg_fit_size_selector_information_v0: [],
      msg_fit_policies_reassurance_v0: ["returns-policy"],
      msg_fit_size_selector_evidence_v0: ["fit-data", "availability"],
      msg_price_price_information_v0: [],
      msg_price_price_evidence_v0: ["current-price"],
      msg_price_price_incentive_v0: ["incentive"],
      msg_returns_policies_information_v0: [],
      msg_returns_policies_reassurance_v0: ["returns-policy"],
    });
  });
});
