// Authentication is a service the security adapter consults, not a use case (ADR-023): the
// credential resolves the merchant and the origin, if present, must be one of theirs.
import { describe, expect, it } from "vitest";
import {
  DefaultIngestKeyResolver,
  type MerchantDirectory,
} from "../../../../src/application/merchant/index.js";
import { OriginNotAllowed, Unauthorized } from "../../../../src/domain/merchant/index.js";
import { fakeMinter, TEST_NOW, testMerchant } from "../../../helpers/merchants.js";

const merchant = testMerchant({ ingestKeys: ["key-a-1"], origins: ["https://shop-a.example"] });
const merchants: MerchantDirectory = {
  findByIngestKey: (fp, now) => Promise.resolve(merchant.owns(fp, now) ? merchant : undefined),
  findByPlatformKey: (fp, now) => Promise.resolve(merchant.ownsPlatformKey(fp, now) ? merchant : undefined),
  isRegisteredOrigin: (origin) => Promise.resolve(merchant.allowsOrigin(origin)),
};
const resolver = new DefaultIngestKeyResolver({
  merchants,
  minter: fakeMinter,
  clock: { now: () => TEST_NOW },
});

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

  it("a missing or empty key is unauthorized before the minter fingerprints anything", async () => {
    const untouchable = new DefaultIngestKeyResolver({
      merchants,
      minter: {
        ...fakeMinter,
        fingerprintOf: () => Promise.reject(new Error("the minter must not see an absent key")),
      },
      clock: { now: () => TEST_NOW },
    });
    for (const key of [undefined, ""]) {
      expect(await untouchable.resolve(key, undefined)).toMatchObject({
        ok: false,
        error: { code: "unauthorized" },
      });
    }
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
