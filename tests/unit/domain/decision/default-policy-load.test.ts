// The default policy is built by the factories when its module loads: a default that breaks an
// invariant is a programming error and must fail a test, not a file. Imported lazily on purpose.
import { describe, expect, it } from "vitest";

describe("default policy module", () => {
  it("loads: the default rules and policy hold every invariant", async () => {
    const loaded = await import("../../../../src/domain/decision/default-policy.js");
    expect(loaded.DEFAULT_DECISION_POLICY.version).toBe(loaded.DEFAULT_POLICY_VERSION);
    expect(loaded.DEFAULT_DECISION_POLICY.rules.rules.length).toBeGreaterThan(0);
    expect(loaded.DEFAULT_DECISION_POLICY.priority).toHaveLength(3);
  });
});
