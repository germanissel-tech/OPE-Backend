// Feature 012 (FR-030; SC-003): a commercial policy only exists valid, naming the field.
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

const base: CommercialPolicyRecord = {
  version: "sport-commercial-1",
  maxIncentivePercent: 15,
  incentiveLadderPercent: [5, 10, 15],
  marginPercent: 40,
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
    expect(built.value.incentiveLadderPercent).toEqual([5, 10, 15]);
    expect(built.value.marginPercent).toBe(40);
    expect(built.value.cooldownSeconds).toBe(0);
  });

  it("a policy without margin is valid: the margin is what the merchant did not configure", () => {
    const { marginPercent, ...without } = base;
    expect(marginPercent).toBe(40);
    const built = CommercialPolicy.of(without);
    expect(built.ok).toBe(true);
    expect(built.ok && built.value.marginPercent).toBeUndefined();
  });

  it.each<[string, Partial<CommercialPolicyRecord>, string, Record<string, unknown>]>([
    ["blank version", { version: " " }, "invalid-commercial-version", { path: "version" }],
    [
      "ceiling above 100",
      { maxIncentivePercent: 101 },
      "invalid-incentive-ceiling",
      { path: "maxIncentivePercent" },
    ],
    [
      "ceiling fractional",
      { maxIncentivePercent: 7.5 },
      "invalid-incentive-ceiling",
      { path: "maxIncentivePercent" },
    ],
    [
      "ceiling negative",
      { maxIncentivePercent: -1 },
      "invalid-incentive-ceiling",
      { path: "maxIncentivePercent" },
    ],
    [
      "a step above the ceiling",
      { incentiveLadderPercent: [5, 20] },
      "invalid-incentive-ladder",
      { path: "incentiveLadderPercent", index: 1 },
    ],
    [
      "a step not increasing",
      { incentiveLadderPercent: [10, 10] },
      "invalid-incentive-ladder",
      { path: "incentiveLadderPercent", index: 1 },
    ],
    [
      "a step of zero",
      { incentiveLadderPercent: [0, 5] },
      "invalid-incentive-ladder",
      { path: "incentiveLadderPercent", index: 0 },
    ],
    [
      "a fractional step",
      { incentiveLadderPercent: [2.5] },
      "invalid-incentive-ladder",
      { path: "incentiveLadderPercent", index: 0 },
    ],
    ["margin above 100", { marginPercent: 120 }, "invalid-margin", { path: "marginPercent" }],
    ["margin NaN", { marginPercent: Number.NaN }, "invalid-margin", { path: "marginPercent" }],
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

  it("the boundaries are inside: ceiling 0 with an empty ladder, ceiling 100 with a step of 100, margin 0 and 100", () => {
    expect(CommercialPolicy.of({ ...base, maxIncentivePercent: 0, incentiveLadderPercent: [] }).ok).toBe(
      true,
    );
    expect(
      CommercialPolicy.of({ ...base, maxIncentivePercent: 100, incentiveLadderPercent: [1, 100] }).ok,
    ).toBe(true);
    expect(CommercialPolicy.of({ ...base, marginPercent: 0 }).ok).toBe(true);
    expect(CommercialPolicy.of({ ...base, marginPercent: 100 }).ok).toBe(true);
    expect(CommercialPolicy.of({ ...base, cooldownSeconds: 0.5 }).ok).toBe(true);
  });

  it("rehydrate does not re-judge", () => {
    expect(CommercialPolicy.rehydrate({ ...base, maxIncentivePercent: 500 }).maxIncentivePercent).toBe(500);
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
