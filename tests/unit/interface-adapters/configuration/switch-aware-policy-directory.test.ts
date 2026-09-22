// Feature 017 — US1 (FR-005, 01 §14.2): the kill switch of the merchant store rides on the
// policies the source declares; a merchant the store does not know is off.
import { describe, expect, it } from "vitest";
import { EMPTY_PROFILE } from "../../../../src/domain/selection/index.js";
import { asMerchantId, BARRIERS } from "../../../../src/domain/shared-kernel/index.js";
import { switchAwarePolicyDirectory } from "../../../../src/interface-adapters/configuration/index.js";
import { testMerchant } from "../../../helpers/merchants.js";
import { testLevels } from "../../../helpers/test-app.js";
import type { PolicySet } from "../../../../src/application/decision/index.js";

const policies = (): PolicySet => ({
  decision: testLevels().defaults.values.decisionPolicy,
  commercial: testLevels().defaults.values.commercialPolicy,
  profile: EMPTY_PROFILE,
  barriers: BARRIERS,
  versions: { platform: "platform-1", defaults: "defaults-1" },
});
const on = testMerchant({ merchantId: "m_on" });
const switched = testMerchant({ merchantId: "m_off" }).switched(false);
if (!switched.ok) throw new Error(switched.error.code);
const off = switched.value;
const directory = switchAwarePolicyDirectory(
  { policySetFor: () => Promise.resolve(policies()) },
  { get: (id) => Promise.resolve([on, off].find((m) => m.merchantId === id)) },
);

describe("switchAwarePolicyDirectory", () => {
  it("an active merchant is enabled with the policies of the source; one switched off is not", async () => {
    expect(await directory.policiesFor(asMerchantId("m_on"))).toEqual({ ...policies(), enabled: true });
    expect(await directory.policiesFor(asMerchantId("m_off"))).toEqual({ ...policies(), enabled: false });
  });

  it("a merchant the store does not know is off", async () => {
    expect((await directory.policiesFor(asMerchantId("m_zzz"))).enabled).toBe(false);
  });
});
