// ADR-025: the platform credential resolves the merchant; nothing else is checked (no browser).
import { describe, expect, it } from "vitest";
import {
  DefaultPlatformKeyResolver,
  type MerchantDirectory,
} from "../../../../src/application/merchant/index.js";
import { Unauthorized } from "../../../../src/domain/merchant/index.js";
import { fakeMinter, TEST_NOW, testMerchant } from "../../../helpers/merchants.js";

const merchant = testMerchant({
  ingestKeys: ["key-a-1"],
  platformKeys: ["platform-a-1"],
  origins: ["https://shop-a.example"],
});
const merchants: MerchantDirectory = {
  findByIngestKey: (fp, now) => Promise.resolve(merchant.owns(fp, now) ? merchant : undefined),
  findByPlatformKey: (fp, now) => Promise.resolve(merchant.ownsPlatformKey(fp, now) ? merchant : undefined),
  isRegisteredOrigin: (origin) => Promise.resolve(merchant.allowsOrigin(origin)),
};
const resolver = new DefaultPlatformKeyResolver({
  merchants,
  minter: fakeMinter,
  clock: { now: () => TEST_NOW },
});

describe("DefaultPlatformKeyResolver", () => {
  it("a registered platform key resolves the merchant", async () => {
    expect(await resolver.resolve("platform-a-1")).toEqual({ ok: true, value: merchant });
  });

  it("a missing or empty key is unauthorized before the minter fingerprints anything", async () => {
    const untouchable = new DefaultPlatformKeyResolver({
      merchants,
      minter: {
        ...fakeMinter,
        fingerprintOf: () => Promise.reject(new Error("the minter must not see an absent key")),
      },
      clock: { now: () => TEST_NOW },
    });
    for (const key of [undefined, ""]) {
      expect(await untouchable.resolve(key)).toMatchObject({ ok: false, error: { code: "unauthorized" } });
    }
  });

  it("no key, an unknown key or an ingest key → Unauthorized", async () => {
    for (const key of [undefined, "nope", "key-a-1"]) {
      const result = await resolver.resolve(key);
      expect(result).toMatchObject({ ok: false, error: { code: "unauthorized", module: "merchant" } });
      if (!result.ok) expect(result.error).toBeInstanceOf(Unauthorized);
    }
  });
});
