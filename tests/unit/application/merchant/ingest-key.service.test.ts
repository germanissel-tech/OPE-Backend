// Authentication is a service the security adapter consults, not a use case (ADR-023): the
// credential resolves the merchant and the origin, if present, must be one of theirs.
import { describe, expect, it } from "vitest";
import {
  DefaultIngestKeyResolver,
  type MerchantDirectory,
} from "../../../../src/application/merchant/index.js";
import { OriginNotAllowed, Unauthorized, type Merchant } from "../../../../src/domain/merchant/index.js";
import { asMerchantId } from "../../../../src/domain/shared-kernel/index.js";

const merchant: Merchant = {
  merchantId: asMerchantId("m_a"),
  ingestKeys: ["key-a-1"],
  origins: ["https://shop-a.example"],
};
const merchants: MerchantDirectory = {
  findByIngestKey: (key) => (merchant.ingestKeys.includes(key) ? merchant : undefined),
  isRegisteredOrigin: (origin) => merchant.origins.includes(origin),
};
const resolver = new DefaultIngestKeyResolver({ merchants });

describe("DefaultIngestKeyResolver", () => {
  it("a registered key without origin resolves the merchant", async () => {
    expect(await resolver.resolve("key-a-1", undefined)).toEqual({ ok: true, value: merchant });
  });

  it("a registered key with one of its origins resolves the merchant", async () => {
    expect(await resolver.resolve("key-a-1", "https://shop-a.example")).toEqual({
      ok: true,
      value: merchant,
    });
  });

  it("no key or an unknown key → Unauthorized", async () => {
    const missing = await resolver.resolve(undefined, undefined);
    const unknown = await resolver.resolve("nope", undefined);
    expect(missing).toMatchObject({ ok: false, error: { code: "unauthorized", module: "merchant" } });
    if (!missing.ok) expect(missing.error).toBeInstanceOf(Unauthorized);
    expect(unknown).toMatchObject({ ok: false, error: { code: "unauthorized" } });
  });

  it("a registered key with a foreign origin → OriginNotAllowed", async () => {
    const result = await resolver.resolve("key-a-1", "https://evil.example");
    expect(result).toMatchObject({ ok: false, error: { code: "origin-not-allowed", module: "merchant" } });
    if (!result.ok) expect(result.error).toBeInstanceOf(OriginNotAllowed);
  });
});
