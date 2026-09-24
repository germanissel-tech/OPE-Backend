// Feature 012 (SC-001): the commercial verdict by table — user stories 2 and 3, the order of
// the blocks, the ladder with the abandonment step-up (D-B) and the direct incentive on price.
import { describe, expect, it } from "vitest";
import { FactContext, Signals } from "../../../../src/domain/barrier/index.js";
import {
  CommercialPolicy,
  type CommercialInput,
  type CommercialPolicyRecord,
  type CommercialVerdict,
} from "../../../../src/domain/commercial/commercial-policy.js";
import {
  CANDIDATES,
  QualityGate,
  type Judged,
  type MerchantProfile,
} from "../../../../src/domain/selection/index.js";
import { dwell, sizeSelector } from "../../../helpers/events.js";
import type { Barrier } from "../../../../src/domain/shared-kernel/index.js";

const NOW = new Date("2026-09-19T12:00:00.000Z");
const full: MerchantProfile = { returnsPolicy: true, fitData: true, authorizedAttributes: [] };
const freshEvidence = {
  attributes: new Map<string, string>(),
  stockAndPriceFresh: true,
  available: true,
};
const noSignals = FactContext.of({
  signals: Signals.empty(),
  product: { attributes: new Map() },
  readingSeconds: 5,
});
const risky = FactContext.of({
  signals: Signals.of([sizeSelector(1), sizeSelector(2), dwell(3, "policies", 6000)]),
  product: { attributes: new Map() },
  readingSeconds: 5,
});

const record: CommercialPolicyRecord = {
  version: "v",
  maxIncentiveShare: 0.1,
  incentiveLadderShare: [0.05, 0.1],
  marginShare: 0.4,
  directIncentiveOnPrice: true,
  returnRisk: {
    all: [
      { fact: "eventCount", type: "size_selector_interacted", min: 2 },
      { fact: "dwellSeconds", block: "policies" },
    ],
  },
  highIntent: "from-checkout",
  abandonment: "reassure-returns",
  interventionsPerSession: 1,
  cooldownSeconds: 0,
  interventionsPerVisitorPerDay: 3,
};
const base = CommercialPolicy.rehydrate(record);
const variant = (over: Partial<CommercialPolicyRecord>): CommercialPolicy =>
  CommercialPolicy.rehydrate({ ...record, ...over });
const withoutMargin = (over: Partial<CommercialPolicyRecord> = {}): CommercialPolicy => {
  const rest = { ...record };
  delete rest.marginShare;
  return CommercialPolicy.rehydrate({ ...rest, ...over });
};

const judgedOf = (barrier: Barrier, profile = full, evidence = freshEvidence): readonly Judged[] =>
  QualityGate.of(profile).judgeAll(CANDIDATES[barrier], evidence);

/** The full input; `without` drops optional keys (an absent arm or barrier) exactly, as the plane would. */
const input = (
  over: Partial<CommercialInput> = {},
  without: readonly ("arm" | "barrier")[] = [],
): CommercialInput => {
  const full: CommercialInput = {
    arm: "TREATMENT",
    barrier: "fit",
    trigger: "rules",
    judged: judgedOf("fit"),
    abandoned: false,
    addedToCart: false,
    enteredCheckout: false,
    facts: noSignals,
    session: { interventions: 0 },
    visitorInterventions: 0,
    now: NOW,
    ...over,
  };
  if (without.includes("arm")) delete full.arm;
  if (without.includes("barrier")) delete full.barrier;
  return full;
};

const intervene = (candidateId: string, incentive?: number): CommercialVerdict => {
  const candidate = Object.values(CANDIDATES)
    .flat()
    .find((c) => c.candidateId === candidateId);
  if (!candidate) throw new Error(candidateId);
  return {
    kind: "intervene",
    candidateId,
    barrier: candidate.barrier,
    intervention: {
      anchor: candidate.anchor,
      messageVersionId: candidateId,
      ...(incentive === undefined ? {} : { incentive: { kind: "percent", value: incentive } }),
    },
  };
};

describe("CommercialPolicy.verdict — the ladder (user story 2)", () => {
  it.each<[string, CommercialPolicy, CommercialInput, CommercialVerdict]>([
    [
      "1. fit: the lowest acceptable step, no incentive",
      base,
      input(),
      intervene("msg_fit_size_selector_information_v0"),
    ],
    [
      "2. price with the direct incentive, margin and ceiling → the incentive at the first step",
      base,
      input({ barrier: "price", judged: judgedOf("price") }),
      intervene("msg_price_price_incentive_v0", 0.05),
    ],
    [
      "3a. price without margin → the next acceptable, non-economic candidate",
      withoutMargin(),
      input({ barrier: "price", judged: judgedOf("price") }),
      intervene("msg_price_price_information_v0"),
    ],
    [
      "3b. price without margin and only the incentive acceptable → commercial-policy-blocked",
      withoutMargin(),
      input({ barrier: "price", judged: judgedOf("price").filter((j) => j.candidate.step === "incentive") }),
      {
        kind: "no-op",
        reason: "commercial-policy-blocked",
        blocked: { candidateId: "msg_price_price_incentive_v0", reason: "margin-missing" },
      },
    ],
    [
      "5. high return risk with price → the value message, no incentive",
      base,
      input({ barrier: "price", judged: judgedOf("price"), facts: risky }),
      intervene("msg_price_price_information_v0"),
    ],
    [
      "ceiling 0 → incentive-not-allowed, the rest of the ladder goes on",
      variant({ maxIncentiveShare: 0, incentiveLadderShare: [] }),
      input({ barrier: "price", judged: judgedOf("price") }),
      intervene("msg_price_price_information_v0"),
    ],
    [
      "no direct incentive on price → the lowest step first",
      variant({ directIncentiveOnPrice: false }),
      input({ barrier: "price", judged: judgedOf("price") }),
      intervene("msg_price_price_information_v0"),
    ],
    [
      "returns with the policy declared → information first (the lowest step)",
      base,
      input({ barrier: "returns", judged: judgedOf("returns") }),
      intervene("msg_returns_policies_information_v0"),
    ],
    [
      "nothing acceptable → no-acceptable-candidate",
      base,
      input({
        barrier: "fit",
        judged: judgedOf("fit").map((j) => ({ ...j, verdict: { acceptable: false, reason: "no-fit-data" } })),
      }),
      { kind: "no-op", reason: "no-acceptable-candidate" },
    ],
    [
      "no barrier → barrier-unclear",
      base,
      input({ trigger: "none", judged: [] }, ["barrier"]),
      { kind: "no-op", reason: "barrier-unclear" },
    ],
    [
      "the barrier's evidence is missing → that reason",
      base,
      input({ evidenceReason: "evidence-stale", judged: [] }),
      { kind: "no-op", reason: "evidence-stale" },
    ],
  ])("%s", (_name, policy, given, expected) => {
    expect(policy.verdict(given)).toStrictEqual(expected);
  });

  it("an empty ladder with a positive ceiling → incentive-not-allowed, the ladder goes on", () => {
    const policy = variant({ incentiveLadderShare: [] });
    expect(policy.verdict(input({ barrier: "price", judged: judgedOf("price") }))).toStrictEqual(
      intervene("msg_price_price_information_v0"),
    );
    const only = judgedOf("price").filter((j) => j.candidate.step === "incentive");
    expect(policy.verdict(input({ barrier: "price", judged: only }))).toStrictEqual({
      kind: "no-op",
      reason: "commercial-policy-blocked",
      blocked: { candidateId: "msg_price_price_incentive_v0", reason: "incentive-not-allowed" },
    });
  });

  it("a blocked incentive falls back to the lowest step, in order", () => {
    const judged = judgedOf("price", full, { ...freshEvidence, stockAndPriceFresh: false });
    expect(withoutMargin().verdict(input({ barrier: "price", judged }))).toStrictEqual(
      intervene("msg_price_price_information_v0"),
    );
  });
});

describe("CommercialPolicy.verdict — the gates, in order, keep what would have been chosen", () => {
  it.each<[string, CommercialInput, CommercialVerdict]>([
    [
      "no experiment → no-active-experiment",
      input({}, ["arm"]),
      { kind: "no-op", reason: "no-active-experiment", chosen: "msg_fit_size_selector_information_v0" },
    ],
    [
      "CONTROL → control-arm",
      input({ arm: "CONTROL" }),
      { kind: "no-op", reason: "control-arm", chosen: "msg_fit_size_selector_information_v0" },
    ],
    [
      "entered the checkout → high-intent",
      input({ enteredCheckout: true }),
      { kind: "no-op", reason: "high-intent", chosen: "msg_fit_size_selector_information_v0" },
    ],
    [
      "session budget spent → session-budget-exhausted",
      input({ session: { interventions: 1 } }),
      { kind: "no-op", reason: "session-budget-exhausted", chosen: "msg_fit_size_selector_information_v0" },
    ],
    [
      "visitor fatigue → visitor-fatigue",
      input({ visitorInterventions: 3 }),
      { kind: "no-op", reason: "visitor-fatigue", chosen: "msg_fit_size_selector_information_v0" },
    ],
    [
      "CONTROL with a blocked incentive keeps the block for the ledger",
      {
        ...input({
          arm: "CONTROL",
          barrier: "price",
          judged: judgedOf("price").filter((j) => j.candidate.step === "incentive"),
        }),
        facts: risky,
      },
      {
        kind: "no-op",
        reason: "control-arm",
        blocked: { candidateId: "msg_price_price_incentive_v0", reason: "return-risk" },
      },
    ],
    [
      "high intent wins over a missing barrier",
      input({ judged: [], enteredCheckout: true }, ["barrier"]),
      { kind: "no-op", reason: "high-intent" },
    ],
  ])("%s", (_name, given, expected) => {
    expect(base.verdict(given)).toStrictEqual(expected);
  });

  it("cooldown: within cooldownSeconds of the last intervention the session is exhausted even with budget left", () => {
    const policy = variant({ interventionsPerSession: 2, cooldownSeconds: 600 });
    const recent = { interventions: 1, lastInterventionAt: new Date(NOW.getTime() - 60_000) };
    expect(policy.verdict(input({ session: recent })).kind).toBe("no-op");
    expect(policy.verdict(input({ session: recent }))).toMatchObject({ reason: "session-budget-exhausted" });
    const old = { interventions: 1, lastInterventionAt: new Date(NOW.getTime() - 600_000) };
    expect(policy.verdict(input({ session: old })).kind).toBe("intervene");
  });

  it("high intent from-cart counts the cart; never ignores even the checkout", () => {
    expect(variant({ highIntent: "from-cart" }).verdict(input({ addedToCart: true })).kind).toBe("no-op");
    expect(variant({ highIntent: "from-cart" }).verdict(input({ enteredCheckout: true })).kind).toBe("no-op");
    expect(variant({ highIntent: "from-cart" }).verdict(input()).kind).toBe("intervene");
    expect(variant({ highIntent: "never" }).verdict(input({ enteredCheckout: true })).kind).toBe("intervene");
  });
});

describe("CommercialPolicy.verdict — the abandonment amplifies (user story 3, D-B)", () => {
  it("price without the direct incentive: the abandonment steps up from evidence to the incentive", () => {
    const policy = variant({ directIncentiveOnPrice: false });
    expect(policy.verdict(input({ barrier: "price", judged: judgedOf("price"), abandoned: true }))).toEqual(
      intervene("msg_price_price_evidence_v0"),
    );
    const noEvidence = judgedOf("price", full, { ...freshEvidence, stockAndPriceFresh: false });
    expect(policy.verdict(input({ barrier: "price", judged: noEvidence, abandoned: true }))).toEqual(
      intervene("msg_price_price_incentive_v0", 0.05),
    );
  });

  it("fit: the abandonment steps up from information to reassurance, never an incentive", () => {
    expect(base.verdict(input({ abandoned: true }))).toEqual(intervene("msg_fit_policies_reassurance_v0"));
  });

  it("an abandonment without a signal answers with the reassurance step itself (03 §4.8)", () => {
    expect(
      base.verdict(
        input({ barrier: "returns", trigger: "abandonment", judged: judgedOf("returns"), abandoned: true }),
      ),
    ).toEqual(intervene("msg_returns_policies_reassurance_v0"));
    const noPolicy = judgedOf("returns", { returnsPolicy: false, fitData: false, authorizedAttributes: [] });
    expect(
      base.verdict(input({ barrier: "returns", trigger: "abandonment", judged: noPolicy, abandoned: true })),
    ).toEqual(intervene("msg_returns_policies_information_v0"));
  });

  it("an abandonment without a signal looks for the reassurance step wherever it sits, not one step up", () => {
    const [information, reassurance] = judgedOf("returns");
    const stray: Judged = {
      candidate: {
        candidateId: "msg_returns_stray_evidence_v0",
        barrier: "returns",
        step: "evidence",
        anchor: "policies",
        claims: [],
      },
      verdict: { acceptable: true },
    };
    const judged = [information, stray, reassurance].filter((j) => j !== undefined);
    expect(
      base.verdict(input({ barrier: "returns", trigger: "abandonment", judged, abandoned: true })),
    ).toEqual(intervene("msg_returns_policies_reassurance_v0"));
  });

  it("with a single acceptable candidate the step-up keeps it", () => {
    const only = judgedOf("fit").filter((j) => j.candidate.step === "information");
    expect(base.verdict(input({ judged: only, abandoned: true }))).toEqual(
      intervene("msg_fit_size_selector_information_v0"),
    );
  });

  it("price with the direct incentive blocked: the fallback starts one step up too", () => {
    expect(
      withoutMargin().verdict(input({ barrier: "price", judged: judgedOf("price"), abandoned: true })),
    ).toEqual(intervene("msg_price_price_evidence_v0"));
  });

  it("the direct route is only for price: an incentive candidate of another barrier waits its turn", () => {
    const stray: Judged = {
      candidate: {
        candidateId: "msg_fit_stray_incentive_v0",
        barrier: "fit",
        step: "incentive",
        anchor: "size_selector",
        claims: [{ kind: "incentive" }],
      },
      verdict: { acceptable: true },
    };
    expect(base.verdict(input({ judged: [stray, ...judgedOf("fit")] })).kind).toBe("intervene");
    expect(base.verdict(input({ judged: [...judgedOf("fit"), stray] }))).toEqual(
      intervene("msg_fit_size_selector_information_v0"),
    );
  });

  it("when every higher step is blocked the lowest acceptable comes back", () => {
    const policy = withoutMargin({ directIncentiveOnPrice: false });
    const judged = judgedOf("price", full, { ...freshEvidence, stockAndPriceFresh: false });
    expect(policy.verdict(input({ barrier: "price", judged, abandoned: true }))).toEqual(
      intervene("msg_price_price_information_v0"),
    );
  });
});
