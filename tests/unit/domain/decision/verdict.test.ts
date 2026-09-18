// Feature 011 (SC-001): the verdict by table — the scenarios of user stories 1 and 2, the tie
// by priority, the high-intent criteria and the abandonment answer.
import { describe, expect, it } from "vitest";
import {
  DecisionPolicy,
  DEFAULT_DECISION_POLICY,
  type TruthSummary,
  type Verdict,
  type VerdictInput,
} from "../../../../src/domain/decision/index.js";
import type { Inference } from "../../../../src/domain/barrier/index.js";

const policy = DEFAULT_DECISION_POLICY;
const inference = (fit = 0, price = 0, returns = 0, matched: string[] = []): Inference => ({
  confidences: { fit, price, returns },
  matched,
});
const fresh: TruthSummary = { kind: "known", stockAndPrice: "fresh", available: true };
const input = (over: Partial<VerdictInput> = {}, noExperiment = false): VerdictInput => {
  const base: VerdictInput = {
    inference: inference(),
    abandoned: false,
    truth: fresh,
    interventionsSoFar: 0,
    addedToCart: false,
    enteredCheckout: false,
    ...over,
  };
  return noExperiment ? base : { arm: "TREATMENT", ...base };
};

const intervene = (
  barrier: "fit" | "price" | "returns",
  confidence: number,
  trigger: "rules" | "abandonment" = "rules",
): Verdict => ({
  kind: "intervene",
  barrier,
  confidence,
  trigger,
  intervention: { anchor: policy.anchorFor(barrier), messageVersionId: policy.messageFor(barrier) },
});

describe("DecisionPolicy.verdict — user story 1", () => {
  it.each<[string, VerdictInput, Verdict]>([
    [
      "1. fit over the threshold with fresh truth → INTERVENE at the size selector",
      input({ inference: inference(0.8) }),
      intervene("fit", 0.8),
    ],
    [
      "2. one weak signal → barrier-unclear with the best candidate below the threshold absent",
      input({ inference: inference(0.4) }),
      { kind: "no-op", reason: "barrier-unclear", trigger: "none" },
    ],
    [
      "3. cart then policies → returns at the policies",
      input({ inference: inference(0, 0, 0.8) }),
      intervene("returns", 0.8),
    ],
    [
      "4. abandonment without a signal → returns reassurance with the supporting confidence",
      input({ inference: inference(0, 0.4, 0), abandoned: true }),
      intervene("returns", 0.2, "abandonment"),
    ],
    [
      "5. entered the checkout → high-intent, even with signals",
      input({ inference: inference(0.8), enteredCheckout: true }),
      { kind: "no-op", reason: "high-intent", trigger: "rules", barrier: "fit", confidence: 0.8 },
    ],
    [
      "6. CONTROL → control-arm, with the inferred barrier",
      input({ inference: inference(0.8), arm: "CONTROL" }),
      { kind: "no-op", reason: "control-arm", trigger: "rules", barrier: "fit", confidence: 0.8 },
    ],
    [
      "7. tie → the first in priority (returns before fit before price)",
      input({ inference: inference(0.8, 0.8, 0.8) }),
      intervene("returns", 0.8),
    ],
    [
      "7b. the higher confidence wins over priority",
      input({ inference: inference(1, 0.8, 0.8) }),
      intervene("fit", 1),
    ],
    [
      "8. session budget exhausted → session-budget-exhausted",
      input({ inference: inference(0.8), interventionsSoFar: 1 }),
      {
        kind: "no-op",
        reason: "session-budget-exhausted",
        trigger: "rules",
        barrier: "fit",
        confidence: 0.8,
      },
    ],
    [
      "no active experiment → no-active-experiment, still with the candidate",
      input({ inference: inference(0.8) }, true),
      { kind: "no-op", reason: "no-active-experiment", trigger: "rules", barrier: "fit", confidence: 0.8 },
    ],
    [
      "CONTROL without a candidate → control-arm, trigger none",
      input({ arm: "CONTROL" }),
      { kind: "no-op", reason: "control-arm", trigger: "none" },
    ],
    [
      "abandonment while CONTROL → control-arm with the reassurance candidate",
      input({ arm: "CONTROL", abandoned: true }),
      { kind: "no-op", reason: "control-arm", trigger: "abandonment", barrier: "returns", confidence: 0.2 },
    ],
    [
      "added to cart is not high intent by default",
      input({ inference: inference(0.8), addedToCart: true }),
      intervene("fit", 0.8),
    ],
  ])("%s", (_name, given, expected) => {
    expect(policy.verdict(given)).toEqual(expected);
  });
});

describe("DecisionPolicy.verdict — user story 2 (evidence)", () => {
  it.each<[string, VerdictInput, Verdict]>([
    [
      "1. no catalogue → evidence-missing",
      input({ inference: inference(0.8), truth: { kind: "absent" } }),
      { kind: "no-op", reason: "evidence-missing", trigger: "rules", barrier: "fit", confidence: 0.8 },
    ],
    [
      "2. catalogue older than its budget → evidence-stale",
      input({ inference: inference(0.8), truth: { kind: "stale" } }),
      { kind: "no-op", reason: "evidence-stale", trigger: "rules", barrier: "fit", confidence: 0.8 },
    ],
    [
      "3. variant unavailable with fit → variant-unavailable",
      input({
        inference: inference(0.8),
        truth: { kind: "known", stockAndPrice: "fresh", available: false },
      }),
      { kind: "no-op", reason: "variant-unavailable", trigger: "rules", barrier: "fit", confidence: 0.8 },
    ],
    [
      "4a. stale stock and price with returns → INTERVENE",
      input({
        inference: inference(0, 0, 0.8),
        truth: { kind: "known", stockAndPrice: "stale", available: true },
      }),
      intervene("returns", 0.8),
    ],
    [
      "4b. stale stock and price with fit → INTERVENE (guard only on availability)",
      input({ inference: inference(0.8), truth: { kind: "known", stockAndPrice: "stale", available: true } }),
      intervene("fit", 0.8),
    ],
    [
      "4c. stale stock and price with price → evidence-stale",
      input({
        inference: inference(0, 0.8, 0),
        truth: { kind: "known", stockAndPrice: "stale", available: true },
      }),
      { kind: "no-op", reason: "evidence-stale", trigger: "rules", barrier: "price", confidence: 0.8 },
    ],
    [
      "6a. product without variant with fit → evidence-missing",
      input({ inference: inference(0.8), truth: { kind: "known-product", stockAndPrice: "fresh" } }),
      { kind: "no-op", reason: "evidence-missing", trigger: "rules", barrier: "fit", confidence: 0.8 },
    ],
    [
      "6b. product without variant with returns → INTERVENE",
      input({ inference: inference(0, 0, 0.8), truth: { kind: "known-product", stockAndPrice: "fresh" } }),
      intervene("returns", 0.8),
    ],
    [
      "unknown product → evidence-missing",
      input({ inference: inference(0.8), truth: { kind: "unknown-product" } }),
      { kind: "no-op", reason: "evidence-missing", trigger: "rules", barrier: "fit", confidence: 0.8 },
    ],
    [
      "unknown variant → evidence-missing",
      input({ inference: inference(0.8), truth: { kind: "unknown-variant" } }),
      { kind: "no-op", reason: "evidence-missing", trigger: "rules", barrier: "fit", confidence: 0.8 },
    ],
    [
      "stale variant unavailable with fit → variant-unavailable (the guard applies to old data too)",
      input({
        inference: inference(0.8),
        truth: { kind: "known", stockAndPrice: "stale", available: false },
      }),
      { kind: "no-op", reason: "variant-unavailable", trigger: "rules", barrier: "fit", confidence: 0.8 },
    ],
    [
      "the abandonment reassurance also needs evidence",
      input({ abandoned: true, truth: { kind: "absent" } }),
      {
        kind: "no-op",
        reason: "evidence-missing",
        trigger: "abandonment",
        barrier: "returns",
        confidence: 0.2,
      },
    ],
  ])("%s", (_name, given, expected) => {
    expect(policy.verdict(given)).toEqual(expected);
  });
});

describe("DecisionPolicy.verdict — policy variations", () => {
  const variant = (over: Partial<Parameters<typeof DecisionPolicy.rehydrate>[0]>): DecisionPolicy =>
    DecisionPolicy.rehydrate({
      version: "v",
      rules: policy.rules,
      threshold: policy.threshold,
      priority: policy.priority,
      highIntent: policy.highIntent,
      abandonment: policy.abandonment,
      interventionsPerSession: policy.interventionsPerSession,
      evidence: policy.evidence,
      ...over,
    });

  it("highIntent from-cart: added to cart is enough; never: not even the checkout", () => {
    const fromCart = variant({ highIntent: "from-cart" });
    expect(fromCart.verdict(input({ inference: inference(0.8), addedToCart: true })).kind).toBe("no-op");
    expect(fromCart.verdict(input({ inference: inference(0.8), enteredCheckout: true })).kind).toBe("no-op");
    expect(fromCart.verdict(input({ inference: inference(0.8) }))).toEqual(intervene("fit", 0.8));
    expect(
      variant({ highIntent: "never" }).verdict(input({ inference: inference(0.8), enteredCheckout: true })),
    ).toEqual(intervene("fit", 0.8));
  });

  it("abandonment nothing: an abandonment without a signal is barrier-unclear", () => {
    expect(variant({ abandonment: "nothing" }).verdict(input({ abandoned: true }))).toEqual({
      kind: "no-op",
      reason: "barrier-unclear",
      trigger: "none",
    });
  });

  it("a signal over the threshold wins over the abandonment reassurance", () => {
    expect(policy.verdict(input({ abandoned: true, inference: inference(0, 0.8, 0) }))).toEqual(
      intervene("price", 0.8),
    );
  });

  it("two interventions per session allow a second one", () => {
    expect(
      variant({ interventionsPerSession: 2 }).verdict(
        input({ inference: inference(0.8), interventionsSoFar: 1 }),
      ),
    ).toEqual(intervene("fit", 0.8));
  });

  it("a different priority breaks the tie differently", () => {
    expect(
      variant({ priority: ["price", "fit", "returns"] }).verdict(
        input({ inference: inference(0.8, 0.8, 0.8) }),
      ),
    ).toEqual(intervene("price", 0.8));
  });

  it("evidence requirements follow the policy: fit may require fresh stock and price too", () => {
    const strict = variant({ evidence: { freshStockAndPrice: ["price", "fit"], availableVariant: ["fit"] } });
    expect(
      strict.verdict(
        input({
          inference: inference(0.8),
          truth: { kind: "known", stockAndPrice: "stale", available: true },
        }),
      ).kind,
    ).toBe("no-op");
  });

  it("the threshold is inclusive", () => {
    expect(policy.verdict(input({ inference: inference(0.6) }))).toEqual(intervene("fit", 0.6));
    expect(policy.verdict(input({ inference: inference(0.5999) })).kind).toBe("no-op");
  });
});
