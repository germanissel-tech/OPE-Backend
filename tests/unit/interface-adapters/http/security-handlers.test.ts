// ADR-025: what each security handler leaves for the controllers and the log, and how the
// controllers find the merchant whichever scheme resolved it.
import { describe, expect, it } from "vitest";
import { Unauthorized } from "../../../../src/domain/merchant/index.js";
import {
  asOperatorId,
  EVERY_MERCHANT,
  Operator,
  OperatorUnknown,
} from "../../../../src/domain/operator/index.js";
import { fail, ok } from "../../../../src/domain/shared-kernel/index.js";
import { makeAdminTokenSecurity } from "../../../../src/interface-adapters/admin/security/admin-token.js";
import { CONSUMER_CAPABILITIES } from "../../../../src/interface-adapters/http/security/capabilities.js";
import { merchantOf, operatorOf } from "../../../../src/interface-adapters/http/security/principal.js";
import { SecurityError } from "../../../../src/interface-adapters/http/typed.js";
import { makeIngestKeySecurity } from "../../../../src/interface-adapters/merchant/security/ingest-key.js";
import { makePlatformKeySecurity } from "../../../../src/interface-adapters/merchant/security/platform-key.js";
import { testMerchant } from "../../../helpers/merchants.js";

const merchant = testMerchant({ ingestKeys: ["k"], platformKeys: ["p"] });

describe("platformKey security handler", () => {
  const handler = makePlatformKeySecurity({
    keys: { resolve: (key) => Promise.resolve(key === "p" ? ok(merchant) : fail(new Unauthorized())) },
    signatures: { verify: () => Promise.resolve(ok(undefined)) },
    clock: { now: () => new Date("2026-09-19T12:00:00.000Z") },
  });

  it("grants the platform capabilities and leaves the merchant for the controller and its id for the log", async () => {
    const outcome = await handler({ headers: { "x-ope-platform-key": "p" } });
    expect(outcome).toEqual({
      principal: { merchant },
      capabilities: CONSUMER_CAPABILITIES.platform,
      log: { merchantId: "m_a" },
    });
  });

  it("reads the first value of a repeated header and rejects an absent or unknown key with unauthorized", async () => {
    expect((await handler({ headers: { "x-ope-platform-key": ["p", "other"] } })).principal).toEqual({
      merchant,
    });
    await expect(handler({ headers: {} })).rejects.toThrow(SecurityError);
    await expect(handler({ headers: { "x-ope-platform-key": ["x"] } })).rejects.toMatchObject({
      slug: "unauthorized",
    });
    await expect(handler({ headers: { "x-ope-platform-key": [] as never } })).rejects.toMatchObject({
      slug: "unauthorized",
    });
  });
});

describe("ingestKey security handler", () => {
  it("grants the sdk capabilities", async () => {
    const handler = makeIngestKeySecurity({ resolve: () => Promise.resolve(ok(merchant)) });
    expect(await handler({ headers: { "x-ope-ingest-key": "k" } })).toEqual({
      principal: { merchant },
      capabilities: CONSUMER_CAPABILITIES.sdk,
      log: { merchantId: "m_a" },
    });
  });
});

describe("merchantOf", () => {
  it("finds the merchant whichever scheme resolved it, skipping schemes that left nothing", () => {
    expect(merchantOf({ security: { ingestKey: null, platformKey: { merchant } } })).toBe(merchant);
    expect(merchantOf({ security: { ingestKey: { merchant } } })).toBe(merchant);
  });

  it("without a merchant principal the wiring is broken: throws", () => {
    expect(() => merchantOf({ security: {} })).toThrow("security handler");
    expect(() => merchantOf({ security: { ingestKey: null } })).toThrow("security handler");
    expect(() => merchantOf({ security: { other: { user: "x" } } })).toThrow("security handler");
  });
});

describe("adminToken security handler (feature 017)", () => {
  const operator = Operator.rehydrate({
    operatorId: asOperatorId("ops-1"),
    tokenFingerprints: ["fp"],
    scope: EVERY_MERCHANT,
  });
  const handler = makeAdminTokenSecurity({
    resolve: (token) => Promise.resolve(token === "t1" ? ok(operator) : fail(new OperatorUnknown())),
  });

  it("grants the admin capabilities and leaves the operator for the controller and its id for the log", async () => {
    const outcome = await handler({ headers: { authorization: "Bearer t1" } });
    expect(outcome).toEqual({
      principal: { operator },
      capabilities: CONSUMER_CAPABILITIES.admin,
      log: { operatorId: "ops-1" },
    });
    expect(operatorOf({ security: { adminToken: outcome.principal } })).toBe(operator);
  });

  it.each(["Bearer t1", "bearer t1", "Bearer  t1", "Bearer t1 "])(
    "%j authenticates: case and spacing do not matter",
    async (authorization) => {
      expect((await handler({ headers: { authorization } })).principal).toEqual({ operator });
    },
  );

  it.each([
    undefined,
    "t1",
    "Basic t1",
    "Bearer",
    "Bearer t2",
    "xBearer t1",
    "Bearer t1 extra",
    ["Bearer t2", "Bearer t1"],
  ])("%j → operator-unknown before the body", async (authorization) => {
    await expect(handler({ headers: { authorization } })).rejects.toMatchObject(
      new SecurityError("operator-unknown"),
    );
  });

  it("operatorOf refuses a request that went through a merchant handler", () => {
    expect(() => operatorOf({ security: { ingestKey: { merchant } } })).toThrow(/admin security handler/);
  });
});
