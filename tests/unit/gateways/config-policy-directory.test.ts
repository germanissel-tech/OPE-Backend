// Feature 012 (FR-023, FR-035): what each merchant declared, completed with the defaults.
import { describe, expect, it } from "vitest";
import { CommercialPolicy, DEFAULT_COMMERCIAL_POLICY } from "../../../src/domain/commercial/index.js";
import { DecisionPolicy, DEFAULT_DECISION_POLICY } from "../../../src/domain/decision/index.js";
import { EMPTY_PROFILE, type MerchantProfile } from "../../../src/domain/selection/index.js";
import { asMerchantId } from "../../../src/domain/shared-kernel/index.js";
import { configPolicyDirectory } from "../../../src/interface-adapters/gateways/decision/config-policy-directory.js";

describe("configPolicyDirectory", () => {
  const decision = DecisionPolicy.rehydrate({
    version: "a-1",
    rules: DEFAULT_DECISION_POLICY.rules,
    threshold: 0.9,
    priority: ["fit", "price", "returns"],
    evidence: { freshStockAndPrice: [], availableVariant: [] },
  });
  const commercial = CommercialPolicy.rehydrate({
    version: "a-commercial-1",
    maxIncentivePercent: 20,
    incentiveLadderPercent: [10, 20],
    marginPercent: 50,
    directIncentiveOnPrice: false,
    returnRisk: { fact: "sessionAddedToCart" },
    highIntent: "never",
    abandonment: "nothing",
    interventionsPerSession: 2,
    cooldownSeconds: 10,
    interventionsPerVisitorPerDay: 9,
  });
  const profile: MerchantProfile = {
    returnsPolicy: true,
    fitData: false,
    authorizedAttributes: ["material"],
  };
  const directory = configPolicyDirectory([
    { merchantId: asMerchantId("m_a"), decision, commercial, profile },
    { merchantId: asMerchantId("m_b"), commercial },
    { merchantId: asMerchantId("m_c") },
  ]);

  it("answers what the merchant declared", async () => {
    expect(await directory.policiesFor(asMerchantId("m_a"))).toEqual({ decision, commercial, profile });
  });

  it("completes what it did not declare with the defaults", async () => {
    expect(await directory.policiesFor(asMerchantId("m_b"))).toEqual({
      decision: DEFAULT_DECISION_POLICY,
      commercial,
      profile: EMPTY_PROFILE,
    });
    expect(await directory.policiesFor(asMerchantId("m_c"))).toEqual({
      decision: DEFAULT_DECISION_POLICY,
      commercial: DEFAULT_COMMERCIAL_POLICY,
      profile: EMPTY_PROFILE,
    });
  });

  it("an unknown merchant gets the defaults too", async () => {
    expect((await directory.policiesFor(asMerchantId("m_zzz"))).commercial).toBe(DEFAULT_COMMERCIAL_POLICY);
  });
});
