// Feature 012 (FR-020..FR-023; SC-002): the quality gate by table — every claim with and
// without its evidence, the first rejection wins, the ladder order is kept, and nothing in
// the profile can accept a claim without evidence.
import { describe, expect, it } from "vitest";
import {
  CANDIDATES,
  EMPTY_PROFILE,
  QualityGate,
  type Candidate,
  type Claim,
  type GateEvidence,
  type GateVerdict,
  type MerchantProfile,
} from "../../../../src/domain/selection/index.js";

const full: MerchantProfile = { returnsPolicy: true, fitData: true, authorizedAttributes: ["material"] };
const fresh: GateEvidence = {
  attributes: new Map([["material", "cotton"]]),
  stockAndPriceFresh: true,
  available: true,
};
const candidate = (claims: Claim[]): Candidate => ({
  candidateId: "msg_test",
  barrier: "fit",
  step: "evidence",
  anchor: "size_selector",
  claims,
});
const rejected = (reason: string): GateVerdict => ({ acceptable: false, reason: reason as never });

describe("QualityGate.judge — one claim at a time", () => {
  interface Case {
    claim: Claim;
    profile: MerchantProfile;
    evidence: GateEvidence;
    expected: GateVerdict;
  }
  const row = (
    name: string,
    claim: Claim,
    given: Omit<Case, "claim" | "expected">,
    expected: GateVerdict,
  ): [string, Case] => [name, { claim, ...given, expected }];
  const ok: GateVerdict = { acceptable: true };
  const stale = { ...fresh, stockAndPriceFresh: false };
  const unavailable = { ...fresh, available: false };
  const noVariant: GateEvidence = {
    attributes: fresh.attributes,
    stockAndPriceFresh: true,
  };

  it.each<[string, Case]>([
    row("returns policy declared", "returns-policy", { profile: full, evidence: fresh }, ok),
    row(
      "returns policy not declared",
      "returns-policy",
      { profile: EMPTY_PROFILE, evidence: fresh },
      rejected("no-returns-policy"),
    ),
    row("fit data provided", "fit-data", { profile: full, evidence: fresh }, ok),
    row(
      "fit data not provided",
      "fit-data",
      { profile: EMPTY_PROFILE, evidence: fresh },
      rejected("no-fit-data"),
    ),
    row(
      "current price with fresh stock and price",
      "current-price",
      { profile: EMPTY_PROFILE, evidence: fresh },
      ok,
    ),
    row(
      "current price with stale stock and price",
      "current-price",
      { profile: full, evidence: stale },
      rejected("stale-price"),
    ),
    row(
      "availability with an available variant",
      "availability",
      { profile: EMPTY_PROFILE, evidence: fresh },
      ok,
    ),
    row(
      "availability with an unavailable variant",
      "availability",
      { profile: full, evidence: unavailable },
      rejected("variant-unavailable"),
    ),
    row(
      "availability without a variant in focus",
      "availability",
      { profile: full, evidence: noVariant },
      rejected("variant-unavailable"),
    ),
    row(
      "incentive is always the commercial policy's call",
      "incentive",
      { profile: EMPTY_PROFILE, evidence: stale },
      ok,
    ),
    row(
      "attribute present and authorized",
      "product-attribute:material",
      { profile: full, evidence: fresh },
      ok,
    ),
    row(
      "attribute the product does not have",
      "product-attribute:season",
      { profile: full, evidence: fresh },
      rejected("attribute-unknown"),
    ),
    row(
      "attribute present but not authorized",
      "product-attribute:material",
      { profile: EMPTY_PROFILE, evidence: fresh },
      rejected("attribute-not-authorized"),
    ),
  ])("%s", (_name, { claim, profile, evidence, expected }) => {
    expect(QualityGate.of(profile).judge(candidate([claim]), evidence)).toEqual(expected);
  });

  it("the empty profile declares nothing", () => {
    expect(EMPTY_PROFILE).toStrictEqual({ returnsPolicy: false, fitData: false, authorizedAttributes: [] });
  });

  it("a candidate without claims is always acceptable, whatever the evidence", () => {
    const nothing: GateEvidence = { attributes: new Map(), stockAndPriceFresh: false };
    expect(QualityGate.of(EMPTY_PROFILE).judge(candidate([]), nothing)).toEqual({ acceptable: true });
  });

  it("the first unsupported claim, in declaration order, rejects the candidate entire", () => {
    const evidence = { ...fresh, stockAndPriceFresh: false, available: false };
    expect(QualityGate.of(full).judge(candidate(["current-price", "availability"]), evidence)).toEqual(
      rejected("stale-price"),
    );
    expect(QualityGate.of(full).judge(candidate(["availability", "current-price"]), evidence)).toEqual(
      rejected("variant-unavailable"),
    );
    expect(QualityGate.of(full).judge(candidate(["returns-policy", "availability"]), evidence)).toEqual(
      rejected("variant-unavailable"),
    );
  });

  it("no profile relaxes a claim without evidence (constitution II)", () => {
    const generous: MerchantProfile = {
      returnsPolicy: true,
      fitData: true,
      authorizedAttributes: ["material", "season"],
    };
    expect(
      QualityGate.of(generous).judge(candidate(["current-price"]), { ...fresh, stockAndPriceFresh: false }),
    ).toEqual(rejected("stale-price"));
    expect(QualityGate.of(generous).judge(candidate(["product-attribute:season"]), fresh)).toEqual(
      rejected("attribute-unknown"),
    );
    expect(
      QualityGate.of(generous).judge(candidate(["availability"]), { ...fresh, available: false }),
    ).toEqual(rejected("variant-unavailable"));
  });
});

describe("QualityGate.judgeAll — the catalogue", () => {
  it("judges the candidates of a barrier in ladder order, keeping the rejections", () => {
    const judged = QualityGate.of(EMPTY_PROFILE).judgeAll(CANDIDATES.fit, { ...fresh, available: false });
    expect(judged.map((j) => [j.candidate.step, j.verdict])).toEqual([
      ["information", { acceptable: true }],
      ["reassurance", rejected("no-returns-policy")],
      ["evidence", rejected("no-fit-data")],
    ]);
    const priced = QualityGate.of(full).judgeAll(CANDIDATES.price, { ...fresh, stockAndPriceFresh: false });
    expect(priced.map((j) => j.verdict.acceptable)).toEqual([true, false, true]);
  });

  it("is deterministic: 1 000 judgements of the same candidate and evidence agree", () => {
    const gate = QualityGate.of(full);
    const first = gate.judgeAll(CANDIDATES.fit, fresh);
    for (let i = 0; i < 1000; i++) expect(gate.judgeAll(CANDIDATES.fit, fresh)).toEqual(first);
    expect(first.every((j) => j.verdict.acceptable)).toBe(true);
  });
});
