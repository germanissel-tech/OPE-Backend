// Feature 012 (FR-035): the default commercial policy encodes the values proposed to the stakeholder.
import { describe, expect, it } from "vitest";
import { FactContext, Signals } from "../../../../src/domain/barrier/index.js";
import { dwell, sizeSelector } from "../../../helpers/events.js";

describe("DEFAULT_COMMERCIAL_POLICY", () => {
  it("loads and carries the stakeholder's values: no margin, so no incentive until configured", async () => {
    const { DEFAULT_COMMERCIAL_POLICY, DEFAULT_COMMERCIAL_POLICY_VERSION } =
      await import("../../../../src/domain/commercial/default-commercial-policy.js");
    const policy = DEFAULT_COMMERCIAL_POLICY;
    expect(policy.version).toBe(DEFAULT_COMMERCIAL_POLICY_VERSION);
    expect(policy.version).toBe("commercial-default-1");
    expect(policy.maxIncentiveShare).toBe(0.1);
    expect(policy.incentiveLadderShare).toEqual([0.05, 0.1]);
    expect(policy.marginShare).toBeUndefined();
    expect(policy.directIncentiveOnPrice).toBe(true);
    expect(policy.highIntent).toBe("from-checkout");
    expect(policy.abandonment).toBe("reassure-returns");
    expect(policy.interventionsPerSession).toBe(1);
    expect(policy.cooldownSeconds).toBe(0);
    expect(policy.interventionsPerVisitorPerDay).toBe(3);
  });

  it("the return risk holds when the visitor doubted the size and read the policies", async () => {
    const { DEFAULT_COMMERCIAL_POLICY } =
      await import("../../../../src/domain/commercial/default-commercial-policy.js");
    const facts = (events: Parameters<typeof Signals.of>[0]) =>
      FactContext.of({ signals: Signals.of(events), product: { attributes: new Map() }, readingSeconds: 5 });
    expect(
      facts([sizeSelector(1), sizeSelector(2), dwell(3, "policies", 6000)]).holds(
        DEFAULT_COMMERCIAL_POLICY.returnRisk,
      ),
    ).toBe(true);
    expect(
      facts([sizeSelector(1), dwell(3, "policies", 6000)]).holds(DEFAULT_COMMERCIAL_POLICY.returnRisk),
    ).toBe(false);
    expect(facts([sizeSelector(1), sizeSelector(2)]).holds(DEFAULT_COMMERCIAL_POLICY.returnRisk)).toBe(false);
  });
});
