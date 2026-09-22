// Feature 017 — FR-007: the admin security handler resolves the operator by token fingerprint.
import { describe, expect, it } from "vitest";
import { DefaultAdminTokenResolver } from "../../../../src/application/access/index.js";
import { asOperatorId, EVERY_MERCHANT, Operator } from "../../../../src/domain/operator/index.js";
import { configOperatorDirectory } from "../../../../src/interface-adapters/access/index.js";

/** Like Node crypto: only a non-empty string can be digested. */
const fingerprints = {
  fingerprintOf: (token: string) => {
    if (typeof token !== "string" || token === "") throw new TypeError("not a token");
    return Promise.resolve(`fp:${token}`);
  },
};
const operator = Operator.rehydrate({
  operatorId: asOperatorId("ops-1"),
  tokenFingerprints: ["fp:t1"],
  scope: EVERY_MERCHANT,
});
const resolver = new DefaultAdminTokenResolver({
  operators: configOperatorDirectory([operator]),
  fingerprints,
});

describe("DefaultAdminTokenResolver", () => {
  it("resolves the operator whose fingerprint matches the presented token", async () => {
    const r = await resolver.resolve("t1");
    expect(r.ok && r.value.operatorId).toBe("ops-1");
  });

  it.each([undefined, "", "t2"])("%j → operator-unknown", async (token) => {
    const r = await resolver.resolve(token);
    expect(r.ok ? undefined : r.error.code).toBe("operator-unknown");
  });
});
