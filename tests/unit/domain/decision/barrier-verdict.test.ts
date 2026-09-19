// Feature 011 (SC-001), reduced by feature 012: the barrier the rules settle on (threshold,
// priority on a tie) and whether its evidence can sustain it — user story 2 of the 011.
import { describe, expect, it } from "vitest";
import {
  DecisionPolicy,
  DEFAULT_DECISION_POLICY,
  type BarrierVerdict,
  type TruthSummary,
} from "../../../../src/domain/decision/index.js";
import type { Inference } from "../../../../src/domain/barrier/index.js";

const policy = DEFAULT_DECISION_POLICY;
const inference = (fit = 0, price = 0, returns = 0): Inference => ({
  confidences: { fit, price, returns },
  matched: [],
});
const fresh: TruthSummary = { kind: "known", stockAndPrice: "fresh", available: true };
const stale: TruthSummary = { kind: "known", stockAndPrice: "stale", available: true };

describe("DecisionPolicy.barrierVerdict — the dominant barrier", () => {
  it.each<[string, Inference, BarrierVerdict]>([
    ["fit over the threshold", inference(0.8), { barrier: "fit", confidence: 0.8 }],
    ["one weak signal → no barrier", inference(0.4), {}],
    [
      "a tie → the first in priority (returns before fit before price)",
      inference(0.8, 0.8, 0.8),
      { barrier: "returns", confidence: 0.8 },
    ],
    ["the higher confidence wins over priority", inference(1, 0.8, 0.8), { barrier: "fit", confidence: 1 }],
    ["the threshold is inclusive", inference(0.6), { barrier: "fit", confidence: 0.6 }],
    ["just below the threshold → no barrier", inference(0.5999), {}],
  ])("%s", (_name, given, expected) => {
    expect(policy.barrierVerdict({ inference: given, truth: fresh })).toEqual(expected);
  });

  it("a different priority breaks the tie differently", () => {
    const other = DecisionPolicy.rehydrate({
      version: "v",
      rules: policy.rules,
      threshold: policy.threshold,
      priority: ["price", "fit", "returns"],
      evidence: policy.evidence,
    });
    expect(other.barrierVerdict({ inference: inference(0.8, 0.8, 0.8), truth: fresh })).toEqual({
      barrier: "price",
      confidence: 0.8,
    });
  });
});

describe("DecisionPolicy.barrierVerdict — the evidence of the barrier (user story 2 of the 011)", () => {
  it.each<[string, Inference, TruthSummary, string | undefined]>([
    ["no catalogue → evidence-missing", inference(0.8), { kind: "absent" }, "evidence-missing"],
    ["catalogue older than its budget → evidence-stale", inference(0.8), { kind: "stale" }, "evidence-stale"],
    ["unknown product → evidence-missing", inference(0.8), { kind: "unknown-product" }, "evidence-missing"],
    ["unknown variant → evidence-missing", inference(0.8), { kind: "unknown-variant" }, "evidence-missing"],
    [
      "variant unavailable with fit → variant-unavailable",
      inference(0.8),
      { ...fresh, available: false },
      "variant-unavailable",
    ],
    ["stale stock and price with returns → sustained", inference(0, 0, 0.8), stale, undefined],
    [
      "stale stock and price with fit → sustained (the guard is only on availability)",
      inference(0.8),
      stale,
      undefined,
    ],
    ["stale stock and price with price → evidence-stale", inference(0, 0.8, 0), stale, "evidence-stale"],
    [
      "product without variant with fit → evidence-missing",
      inference(0.8),
      { kind: "known-product", stockAndPrice: "fresh" },
      "evidence-missing",
    ],
    [
      "product without variant with returns → sustained",
      inference(0, 0, 0.8),
      { kind: "known-product", stockAndPrice: "fresh" },
      undefined,
    ],
    [
      "product without variant with price and stale price → evidence-stale",
      inference(0, 0.8, 0),
      { kind: "known-product", stockAndPrice: "stale" },
      "evidence-stale",
    ],
    [
      "stale and unavailable with fit → variant-unavailable",
      inference(0.8),
      { ...stale, available: false },
      "variant-unavailable",
    ],
  ])("%s", (_name, given, truth, evidenceReason) => {
    const verdict = policy.barrierVerdict({ inference: given, truth });
    expect(verdict.barrier).toBeDefined();
    expect(verdict.evidenceReason).toBe(evidenceReason);
  });

  it("evidence requirements follow the policy: fit may require fresh stock and price too", () => {
    const strict = DecisionPolicy.rehydrate({
      version: "v",
      rules: policy.rules,
      threshold: policy.threshold,
      priority: policy.priority,
      evidence: { freshStockAndPrice: ["price", "fit"], availableVariant: ["fit"] },
    });
    expect(strict.barrierVerdict({ inference: inference(0.8), truth: stale }).evidenceReason).toBe(
      "evidence-stale",
    );
  });

  it("without a barrier the evidence is not judged", () => {
    expect(policy.barrierVerdict({ inference: inference(), truth: { kind: "absent" } })).toEqual({});
  });
});
