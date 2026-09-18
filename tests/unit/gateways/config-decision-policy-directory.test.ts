// Feature 011 (FR-023): the merchant's policy, or the default one.
import { describe, expect, it } from "vitest";
import { DecisionPolicy, DEFAULT_DECISION_POLICY } from "../../../src/domain/decision/index.js";
import { asMerchantId } from "../../../src/domain/shared-kernel/index.js";
import { configDecisionPolicyDirectory } from "../../../src/interface-adapters/gateways/decision/config-decision-policy-directory.js";

describe("configDecisionPolicyDirectory", () => {
  const own = DecisionPolicy.rehydrate({
    version: "a-1",
    rules: DEFAULT_DECISION_POLICY.rules,
    threshold: 0.9,
    priority: ["fit", "price", "returns"],
    highIntent: "never",
    abandonment: "nothing",
    interventionsPerSession: 2,
    evidence: { freshStockAndPrice: [], availableVariant: [] },
  });
  const directory = configDecisionPolicyDirectory([
    { merchantId: asMerchantId("m_a"), policy: own },
    { merchantId: asMerchantId("m_b") },
  ]);

  it("answers the merchant's own policy when it declared one", async () => {
    expect(await directory.policyFor(asMerchantId("m_a"))).toBe(own);
  });

  it("answers the default policy for a merchant without one, and for an unknown merchant", async () => {
    expect(await directory.policyFor(asMerchantId("m_b"))).toBe(DEFAULT_DECISION_POLICY);
    expect(await directory.policyFor(asMerchantId("m_zzz"))).toBe(DEFAULT_DECISION_POLICY);
  });
});
