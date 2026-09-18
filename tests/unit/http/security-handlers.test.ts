// ADR-025: what each security handler leaves for the controllers and the log, and how the
// controllers find the merchant whichever scheme resolved it.
import { describe, expect, it } from "vitest";
import { Merchant, Unauthorized } from "../../../src/domain/merchant/index.js";
import { asMerchantId, fail, ok } from "../../../src/domain/shared-kernel/index.js";
import { CONSUMER_CAPABILITIES } from "../../../src/interface-adapters/http/security/capabilities.js";
import {
  makeIngestKeySecurity,
  merchantOf,
} from "../../../src/interface-adapters/http/security/ingest-key.js";
import { makePlatformKeySecurity } from "../../../src/interface-adapters/http/security/platform-key.js";
import { SecurityError } from "../../../src/interface-adapters/http/typed.js";

const built = Merchant.of({
  merchantId: asMerchantId("m_a"),
  ingestKeys: ["k"],
  origins: ["https://a.example"],
  platformKeys: ["p"],
});
if (!built.ok) throw new Error("merchant");
const merchant = built.value;

describe("platformKey security handler", () => {
  const handler = makePlatformKeySecurity({
    resolve: (key) => Promise.resolve(key === "p" ? ok(merchant) : fail(new Unauthorized())),
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
