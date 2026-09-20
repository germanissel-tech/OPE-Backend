// Feature 017 — US1 (FR-007): an operator holds tokens by fingerprint and acts within a scope.
import { describe, expect, it } from "vitest";
import { EVERY_MERCHANT, Operator, asOperatorId } from "../../../../src/domain/admin/index.js";
import { asMerchantId } from "../../../../src/domain/shared-kernel/index.js";

const A = asMerchantId("mrc_a");
const B = asMerchantId("mrc_b");
const record = (over: Partial<Parameters<typeof Operator.of>[0]> = {}) => ({
  operatorId: asOperatorId("ops-1"),
  tokenFingerprints: ["f1"],
  scope: EVERY_MERCHANT as "*" | readonly (typeof A)[],
  ...over,
});

const valid = (over: Partial<Parameters<typeof Operator.of>[0]> = {}): Operator => {
  const r = Operator.of(record(over));
  if (!r.ok) throw new Error(r.error.code);
  return r.value;
};

describe("Operator.of", () => {
  it("accepts one or two fingerprints and a scope of * or merchants", () => {
    expect(valid().scope).toBe("*");
    expect(valid({ tokenFingerprints: ["f1", "f2"], scope: [A] }).scope).toEqual([A]);
  });

  it.each([[[]], [["f1", "f2", "f3"]]])("rejects %j fingerprints", (fingerprints) => {
    const r = Operator.of(record({ tokenFingerprints: fingerprints }));
    expect(r.ok ? undefined : r.error.code).toBe("invalid-operator-tokens");
  });

  it("names a blank fingerprint and an empty merchant of the scope by index", () => {
    const blank = Operator.of(record({ tokenFingerprints: ["f1", " "] }));
    expect(blank.ok ? undefined : blank.error.details).toEqual({ index: 1 });
    const empty = Operator.of(record({ scope: [A, asMerchantId(" ")] }));
    expect(empty.ok ? undefined : [empty.error.code, empty.error.details]).toEqual([
      "invalid-operator-scope",
      { index: 1 },
    ]);
  });

  it("rehydrate does not re-judge", () => {
    expect(Operator.rehydrate(record({ tokenFingerprints: [] })).tokenFingerprints).toEqual([]);
  });
});

describe("Operator rules", () => {
  it("holds a token by fingerprint only", () => {
    const op = valid({ tokenFingerprints: ["f1", "f2"] });
    expect(op.holds("f2")).toBe(true);
    expect(op.holds("token")).toBe(false);
  });

  it("scopeFor: * allows every merchant; a list allows only its members; the error never names the merchant", () => {
    expect(valid().scopeFor(B).ok).toBe(true);
    const scoped = valid({ scope: [A] });
    expect(scoped.scopeFor(A).ok).toBe(true);
    const denied = scoped.scopeFor(B);
    expect(denied.ok ? undefined : denied.error.code).toBe("merchant-out-of-scope");
    expect(denied.ok ? "" : denied.error.message).not.toContain("mrc_b");
    expect(valid({ scope: [] }).scopeFor(A).ok).toBe(false);
  });
});
