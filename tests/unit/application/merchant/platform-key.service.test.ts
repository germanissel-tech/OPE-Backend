// ADR-025: the platform credential resolves the merchant; nothing else is checked (no browser).
import { describe, expect, it } from "vitest";
import {
  DefaultPlatformKeyResolver,
  type MerchantDirectory,
} from "../../../../src/application/merchant/index.js";
import { Merchant, Unauthorized } from "../../../../src/domain/merchant/index.js";
import { asMerchantId } from "../../../../src/domain/shared-kernel/index.js";

const built = Merchant.of({
  merchantId: asMerchantId("m_a"),
  ingestKeys: ["key-a-1"],
  origins: ["https://shop-a.example"],
  platformKeys: ["platform-a-1"],
});
if (!built.ok) throw new Error("test merchant");
const merchant = built.value;
const merchants: MerchantDirectory = {
  findByIngestKey: (key) => Promise.resolve(merchant.owns(key) ? merchant : undefined),
  findByPlatformKey: (key) => Promise.resolve(merchant.ownsPlatformKey(key) ? merchant : undefined),
  isRegisteredOrigin: (origin) => Promise.resolve(merchant.allowsOrigin(origin)),
};
const resolver = new DefaultPlatformKeyResolver({ merchants });

describe("DefaultPlatformKeyResolver", () => {
  it("a registered platform key resolves the merchant", async () => {
    expect(await resolver.resolve("platform-a-1")).toEqual({ ok: true, value: merchant });
  });

  it("no key, an unknown key or an ingest key → Unauthorized", async () => {
    for (const key of [undefined, "nope", "key-a-1"]) {
      const result = await resolver.resolve(key);
      expect(result).toMatchObject({ ok: false, error: { code: "unauthorized", module: "merchant" } });
      if (!result.ok) expect(result.error).toBeInstanceOf(Unauthorized);
    }
  });
});
