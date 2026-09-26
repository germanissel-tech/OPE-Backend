// Feature 012 (FR-030; SC-003) and feature 015 (F-031): a commercial policy only exists valid, naming
// the field; inside the domain it speaks rates 0..1 (the percentages stay at the configuration edge).
// Imported from the files, not the module index: the index loads the default policy at import
// time, and a mutant that breaks `CommercialPolicy.of` would then break the file instead of a test.
import { describe, expect, it } from "vitest";
import {
  CommercialPolicy,
  type CommercialPolicyRecord,
} from "../../../../src/domain/commercial/commercial-policy.js";
import {
  InvalidCommercialVersion,
  InvalidCooldown,
  InvalidIncentiveCeiling,
  InvalidIncentiveLadder,
  InvalidInterventionBudget,
  InvalidMargin,
  InvalidReturnRisk,
} from "../../../../src/domain/commercial/errors.js";

/** A percentage as the rate the domain stores: keeps the stakeholder's figures readable in the cases. */
const pct = (n: number): number => n / 100;

const base: CommercialPolicyRecord = {
  version: "sport-commercial-1",
  maxIncentiveShare: pct(15),
  incentiveLadderShare: [pct(5), pct(10), pct(15)],
  marginShare: pct(40),
  directIncentiveOnPrice: true,
  returnRisk: {
    all: [
      { fact: "eventCount", type: "variant_selector_interacted", min: 2 },
      { fact: "dwellSeconds", block: "policies" },
    ],
  },
  highIntent: "from-checkout",
  abandonment: "reassure-returns",
  interventionsPerSession: 1,
  cooldownSeconds: 0,
  interventionsPerVisitorPerDay: 3,
};

const ERROR_BY_CODE = {
  "invalid-commercial-version": InvalidCommercialVersion,
  "invalid-incentive-ceiling": InvalidIncentiveCeiling,
  "invalid-incentive-ladder": InvalidIncentiveLadder,
  "invalid-margin": InvalidMargin,
  "invalid-return-risk": InvalidReturnRisk,
  "invalid-intervention-budget": InvalidInterventionBudget,
  "invalid-cooldown": InvalidCooldown,
} as const;

function rejected(record: CommercialPolicyRecord): { code: string; details: Record<string, unknown> } {
  const built = CommercialPolicy.of(record);
  if (built.ok) throw new Error("expected a rejection");
  expect(built.error).toBeInstanceOf(ERROR_BY_CODE[built.error.code]);
  expect(built.error.module).toBe("commercial");
  return { code: built.error.code, details: built.error.details };
}

describe("CommercialPolicy.of", () => {
  it("accepts a valid policy and keeps its record", () => {
    const built = CommercialPolicy.of(base);
    if (!built.ok) throw new Error(built.error.message);
    expect(built.value.version).toBe("sport-commercial-1");
    expect(built.value.incentiveLadderShare).toEqual([pct(5), pct(10), pct(15)]);
    expect(built.value.marginShare).toBe(pct(40));
    expect(built.value.cooldownSeconds).toBe(0);
  });

  // Feature 023: the rule that a share has to be one of the split's buckets is the split's, and
  // nothing quantises these three — the incentive goes out with the share that was declared. A
  // ceiling of 0.375 has to keep working, or the rule leaked out of the one place that needs it.
  it("the commercial shares are not the split: a finer fraction is valid", () => {
    const fine = CommercialPolicy.of({
      ...base,
      maxIncentiveShare: 0.375,
      incentiveLadderShare: [0.125, 0.375],
      marginShare: 0.3333,
    });
    expect(fine.ok ? fine.value.maxIncentiveShare : fine.error.message).toBe(0.375);
    expect(fine.ok ? fine.value.incentiveLadderShare : undefined).toEqual([0.125, 0.375]);
    expect(fine.ok ? fine.value.marginShare : undefined).toBe(0.3333);
  });

  it("a policy without margin is valid: the margin is what the merchant did not configure", () => {
    const { marginShare, ...without } = base;
    expect(marginShare).toBe(pct(40));
    const built = CommercialPolicy.of(without);
    expect(built.ok).toBe(true);
    expect(built.ok && built.value.marginShare).toBeUndefined();
  });

  it.each<[string, Partial<CommercialPolicyRecord>, string, Record<string, unknown>]>([
    ["blank version", { version: " " }, "invalid-commercial-version", { path: "version" }],
    [
      "ceiling above 1",
      { maxIncentiveShare: 1.01 },
      "invalid-incentive-ceiling",
      { path: "maxIncentiveShare" },
    ],
    [
      "ceiling NaN",
      { maxIncentiveShare: Number.NaN },
      "invalid-incentive-ceiling",
      { path: "maxIncentiveShare" },
    ],
    [
      "ceiling negative",
      { maxIncentiveShare: -0.01 },
      "invalid-incentive-ceiling",
      { path: "maxIncentiveShare" },
    ],
    [
      "a step above the ceiling",
      { incentiveLadderShare: [pct(5), pct(20)] },
      "invalid-incentive-ladder",
      { path: "incentiveLadderShare", index: 1 },
    ],
    [
      "a step not increasing",
      { incentiveLadderShare: [pct(10), pct(10)] },
      "invalid-incentive-ladder",
      { path: "incentiveLadderShare", index: 1 },
    ],
    [
      "a step of zero",
      { incentiveLadderShare: [0, pct(5)] },
      "invalid-incentive-ladder",
      { path: "incentiveLadderShare", index: 0 },
    ],
    [
      "a step that is not a rate",
      { incentiveLadderShare: [Number.POSITIVE_INFINITY] },
      "invalid-incentive-ladder",
      { path: "incentiveLadderShare", index: 0 },
    ],
    ["margin above 1", { marginShare: 1.2 }, "invalid-margin", { path: "marginShare" }],
    ["margin NaN", { marginShare: Number.NaN }, "invalid-margin", { path: "marginShare" }],
    [
      "return risk naming an unknown block",
      { returnRisk: { all: [{ fact: "dwellSeconds", block: "footer" as never }] } },
      "invalid-return-risk",
      { path: "returnRisk.all[0].block" },
    ],
    [
      "session budget of zero",
      { interventionsPerSession: 0 },
      "invalid-intervention-budget",
      { path: "interventionsPerSession" },
    ],
    [
      "visitor budget fractional",
      { interventionsPerVisitorPerDay: 1.5 },
      "invalid-intervention-budget",
      { path: "interventionsPerVisitorPerDay" },
    ],
    ["negative cooldown", { cooldownSeconds: -1 }, "invalid-cooldown", { path: "cooldownSeconds" }],
  ])("rejects %s naming the field", (_name, over, code, details) => {
    expect(rejected({ ...base, ...over })).toEqual({ code, details });
  });

  it("the boundaries are inside: ceiling 0 with an empty ladder, ceiling 1 with a step of 1, margin 0 and 1", () => {
    expect(CommercialPolicy.of({ ...base, maxIncentiveShare: 0, incentiveLadderShare: [] }).ok).toBe(true);
    expect(CommercialPolicy.of({ ...base, maxIncentiveShare: 1, incentiveLadderShare: [pct(1), 1] }).ok).toBe(
      true,
    );
    expect(CommercialPolicy.of({ ...base, marginShare: 0 }).ok).toBe(true);
    expect(CommercialPolicy.of({ ...base, marginShare: 1 }).ok).toBe(true);
    expect(CommercialPolicy.of({ ...base, cooldownSeconds: 0.5 }).ok).toBe(true);
  });

  it("every integer percentage survives the trip percentage → rate → percentage (the edge converts, the domain rounds)", () => {
    for (let percent = 0; percent <= 100; percent += 1) {
      expect(Math.round(pct(percent) * 100)).toBe(percent);
    }
  });

  it("rehydrate does not re-judge", () => {
    expect(CommercialPolicy.rehydrate({ ...base, maxIncentiveShare: 5 }).maxIncentiveShare).toBe(5);
  });

  it("fallbackBarrier: the inferred barrier wins; otherwise returns on an abandonment, only when the policy reassures", () => {
    const policy = CommercialPolicy.rehydrate(base);
    expect(policy.fallbackBarrier("fit", true)).toBe("fit");
    expect(policy.fallbackBarrier(undefined, true)).toBe("returns");
    expect(policy.fallbackBarrier(undefined, false)).toBeUndefined();
    expect(
      CommercialPolicy.rehydrate({ ...base, abandonment: "nothing" }).fallbackBarrier(undefined, true),
    ).toBeUndefined();
  });
});
