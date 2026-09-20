// Feature 011 (FR-020, FR-022), reduced by feature 012: a decision policy only exists valid,
// and it keeps what is inference — rules, threshold, priority, evidence per barrier.
// Imported from the files, not the module index: the index loads the default policy at import
// time, and a mutant that breaks `DecisionPolicy.of` would then break the file instead of a test.
import { describe, expect, it } from "vitest";
import { BarrierRules } from "../../../../src/domain/barrier/index.js";
import {
  DecisionPolicy,
  type DecisionPolicyRecord,
} from "../../../../src/domain/decision/decision-policy.js";
import {
  InvalidPolicyEvidence,
  InvalidPolicyPriority,
  InvalidPolicyThreshold,
  InvalidPolicyVersion,
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
  evidence: { freshStockAndPrice: ["price"], availableVariant: ["fit"] },
};

const ERROR_BY_CODE = {
  "invalid-policy-version": InvalidPolicyVersion,
  "invalid-policy-threshold": InvalidPolicyThreshold,
  "invalid-policy-priority": InvalidPolicyPriority,
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
    expect(built.ok && built.value.rules).toBe(rules);
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
      "evidence naming a stranger",
      { evidence: { freshStockAndPrice: ["price"], availableVariant: ["size" as never] } },
      "invalid-policy-evidence",
      { path: "evidence.availableVariant" },
    ],
  ])("rejects %s naming the field", (_name, over, code, details) => {
    expect(rejected({ ...base, ...over })).toEqual({ code, details });
  });

  it("the boundaries are inside: threshold 0 and 1; a padded version is kept as written", () => {
    // The threshold is judged by the kernel's `isRate` (015 F-030); the table of edges lives in
    // shared-kernel/rate.test.ts.
    expect(DecisionPolicy.of({ ...base, threshold: 1 }).ok).toBe(true);
    expect(rejected({ ...base, threshold: 1.0001 }).code).toBe("invalid-policy-threshold");
    const padded = DecisionPolicy.of({ ...base, version: " v2 " });
    expect(padded.ok && padded.value.version).toBe(" v2 ");
    expect(rejected({ ...base, version: "" }).code).toBe("invalid-policy-version");
  });

  it("rehydrate does not re-judge", () => {
    expect(DecisionPolicy.rehydrate({ ...base, threshold: 7 }).threshold).toBe(7);
  });
});
