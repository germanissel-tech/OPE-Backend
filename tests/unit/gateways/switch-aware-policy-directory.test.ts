// Feature 017 — US1 (FR-005, 01 §14.2): the kill switch of the merchant store rides on the
// policies the source declares; a merchant the store does not know is off.
import { describe, expect, it } from "vitest";
import { DEFAULT_COMMERCIAL_POLICY } from "../../../src/domain/commercial/index.js";
import { DEFAULT_DECISION_POLICY } from "../../../src/domain/decision/index.js";
import { EMPTY_PROFILE } from "../../../src/domain/selection/index.js";
import { asMerchantId } from "../../../src/domain/shared-kernel/index.js";
import { switchAwarePolicyDirectory } from "../../../src/interface-adapters/gateways/decision/switch-aware-policy-directory.js";
import { testMerchant } from "../../helpers/merchants.js";

const policies = {
  decision: DEFAULT_DECISION_POLICY,
  commercial: DEFAULT_COMMERCIAL_POLICY,
  profile: EMPTY_PROFILE,
};
const on = testMerchant({ merchantId: "m_on" });
const switched = testMerchant({ merchantId: "m_off" }).switched(false);
if (!switched.ok) throw new Error(switched.error.code);
const off = switched.value;
const directory = switchAwarePolicyDirectory(
  { policySetFor: () => Promise.resolve(policies) },
  { get: (id) => Promise.resolve([on, off].find((m) => m.merchantId === id)) },
);

describe("switchAwarePolicyDirectory", () => {
  it("an active merchant is enabled with the policies of the source; one switched off is not", async () => {
    expect(await directory.policiesFor(asMerchantId("m_on"))).toEqual({ ...policies, enabled: true });
    expect(await directory.policiesFor(asMerchantId("m_off"))).toEqual({ ...policies, enabled: false });
  });

  it("a merchant the store does not know is off", async () => {
    expect((await directory.policiesFor(asMerchantId("m_zzz"))).enabled).toBe(false);
  });
});
