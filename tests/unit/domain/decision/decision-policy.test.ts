// Feature 011 (FR-020, FR-022, FR-040): a decision policy only exists valid; anchors and
// message placeholders follow the barrier.
import { describe, expect, it } from "vitest";
// Imported from the files, not the module index: the index loads the default policy at import
// time, and a mutant that breaks `DecisionPolicy.of` would then break the file instead of a test.
import { BarrierRules } from "../../../../src/domain/barrier/index.js";
import {
  ANCHOR_BY_BARRIER,
  DecisionPolicy,
  type DecisionPolicyRecord,
} from "../../../../src/domain/decision/decision-policy.js";
import {
  InvalidPolicyEvidence,
  InvalidPolicyPriority,
  InvalidPolicyThreshold,
  InvalidPolicyVersion,
  InvalidSessionBudget,
} from "../../../../src/domain/decision/errors.js";

const rules = BarrierRules.rehydrate({
  rules: [
    { id: "f", barrier: "fit", strength: "strong", when: { fact: "returnedToProduct" } },
    { id: "p", barrier: "price", strength: "strong", when: { fact: "returnedToProduct" } },
    { id: "r", barrier: "returns", strength: "strong", when: { fact: "returnedToProduct" } },
  ],
  weights: { strong: 0.4, supporting: 0.2 },
  readingSeconds: 5,
});

const base: DecisionPolicyRecord = {
  version: "sport-1",
  rules,
  threshold: 0.6,
  priority: ["returns", "fit", "price"],
  highIntent: "from-checkout",
  abandonment: "reassure-returns",
  interventionsPerSession: 1,
  evidence: { freshStockAndPrice: ["price"], availableVariant: ["fit"] },
};

const ERROR_BY_CODE = {
  "invalid-policy-version": InvalidPolicyVersion,
  "invalid-policy-threshold": InvalidPolicyThreshold,
  "invalid-policy-priority": InvalidPolicyPriority,
  "invalid-session-budget": InvalidSessionBudget,
  "invalid-policy-evidence": InvalidPolicyEvidence,
} as const;

function rejected(record: DecisionPolicyRecord): { code: string; details: Record<string, unknown> } {
  const built = DecisionPolicy.of(record);
  if (built.ok) throw new Error("expected a rejection");
  expect(built.error).toBeInstanceOf(ERROR_BY_CODE[built.error.code]);
  expect(built.error.module).toBe("decision");
  return { code: built.error.code, details: built.error.details };
}

describe("DecisionPolicy.of", () => {
  it("accepts a valid policy and keeps its record", () => {
    const built = DecisionPolicy.of(base);
    expect(built.ok && built.value.version).toBe("sport-1");
    expect(built.ok && built.value.priority).toEqual(["returns", "fit", "price"]);
    expect(built.ok && built.value.evidence).toEqual(base.evidence);
  });

  it.each<[string, Partial<DecisionPolicyRecord>, string, Record<string, unknown>]>([
    ["blank version", { version: "  " }, "invalid-policy-version", { path: "version" }],
    ["threshold above 1", { threshold: 1.2 }, "invalid-policy-threshold", { path: "threshold" }],
    ["threshold NaN", { threshold: Number.NaN }, "invalid-policy-threshold", { path: "threshold" }],
    [
      "priority missing a barrier",
      { priority: ["fit", "price"] },
      "invalid-policy-priority",
      { path: "priority" },
    ],
    [
      "priority repeating a barrier",
      { priority: ["fit", "fit", "price"] },
      "invalid-policy-priority",
      { path: "priority" },
    ],
    [
      "priority with all three and one repeated",
      { priority: ["fit", "price", "returns", "fit"] },
      "invalid-policy-priority",
      { path: "priority" },
    ],
    [
      "priority with a stranger",
      { priority: ["fit", "price", "variant" as never] },
      "invalid-policy-priority",
      { path: "priority" },
    ],
    [
      "zero interventions",
      { interventionsPerSession: 0 },
      "invalid-session-budget",
      { path: "interventionsPerSession" },
    ],
    [
      "fractional interventions",
      { interventionsPerSession: 1.5 },
      "invalid-session-budget",
      { path: "interventionsPerSession" },
    ],
    [
      "evidence naming a stranger",
      { evidence: { freshStockAndPrice: ["price"], availableVariant: ["size" as never] } },
      "invalid-policy-evidence",
      { path: "evidence.availableVariant" },
    ],
  ])("rejects %s naming the field", (_name, over, code, details) => {
    expect(rejected({ ...base, ...over })).toEqual({ code, details });
  });

  it("the boundaries are inside: threshold 0 and 1; a padded version is kept as written", () => {
    expect(DecisionPolicy.of({ ...base, threshold: 0 }).ok).toBe(true);
    expect(DecisionPolicy.of({ ...base, threshold: 1 }).ok).toBe(true);
    expect(rejected({ ...base, threshold: -0.0001 }).code).toBe("invalid-policy-threshold");
    expect(rejected({ ...base, threshold: 1.0001 }).code).toBe("invalid-policy-threshold");
    const padded = DecisionPolicy.of({ ...base, version: " v2 " });
    expect(padded.ok && padded.value.version).toBe(" v2 ");
    expect(rejected({ ...base, version: "" }).code).toBe("invalid-policy-version");
  });

  it("rehydrate does not re-judge", () => {
    expect(DecisionPolicy.rehydrate({ ...base, threshold: 7 }).threshold).toBe(7);
  });
});

describe("anchor and message placeholder by barrier (FR-040)", () => {
  const policy = DecisionPolicy.rehydrate(base);

  it.each([
    ["fit", "size_selector", "msg_fit_size_selector_v0"],
    ["price", "price", "msg_price_price_v0"],
    ["returns", "policies", "msg_returns_policies_v0"],
  ] as const)("%s → %s, %s", (barrier, anchor, message) => {
    expect(policy.anchorFor(barrier)).toBe(anchor);
    expect(ANCHOR_BY_BARRIER[barrier]).toBe(anchor);
    expect(policy.messageFor(barrier)).toBe(message);
  });
});
