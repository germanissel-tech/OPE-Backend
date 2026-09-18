// Feature 011 (FR-013): the rule-based implementation of the inference port is the domain's evaluator, no more.
import { describe, expect, it } from "vitest";
import { RuleBasedBarrierInference } from "../../../../src/application/barrier/index.js";
import { Signals } from "../../../../src/domain/barrier/index.js";
import { DEFAULT_DECISION_POLICY } from "../../../../src/domain/decision/index.js";
import { dwell, sizeSelector } from "../../../helpers/events.js";

describe("RuleBasedBarrierInference", () => {
  it("answers exactly what the rules infer", async () => {
    const rules = DEFAULT_DECISION_POLICY.rules;
    const signals = Signals.of([sizeSelector(1), sizeSelector(2), dwell(3, "size_guide", 6000)]);
    const product = { attributes: new Map<string, string>(), available: true };
    const inference = await new RuleBasedBarrierInference().infer({ rules, signals, product });
    expect(inference).toEqual(rules.infer(signals, product));
    expect(inference.confidences.fit).toBe(0.8);
  });
});
