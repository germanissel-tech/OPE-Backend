// Feature 044 (research R-06): the notice key resolves the merchant that owns it; nothing else does — not an
// ingest key, not a platform key — and an absent key is refused before anything is fingerprinted.
import { describe, expect, it } from "vitest";
import { DefaultNoticeKeyResolver } from "../../../../src/application/access/index.js";
import { type MerchantDirectory } from "../../../../src/application/merchant/index.js";
import { Unauthorized } from "../../../../src/domain/merchant/index.js";
import { fakeMinter, TEST_NOW, testMerchant } from "../../../helpers/merchants.js";

const merchant = testMerchant({
  ingestKeys: ["key-a-1"],
  platformKeys: ["platform-a-1"],
  noticeKeys: ["notice-a-1"],
});
const merchants: MerchantDirectory = {
  findByIngestKey: (fp, now) => Promise.resolve(merchant.owns(fp, now) ? merchant : undefined),
  findByPlatformKey: (fp, now) => Promise.resolve(merchant.ownsPlatformKey(fp, now) ? merchant : undefined),
  findByNoticeKey: (fp, now) => Promise.resolve(merchant.ownsNoticeKey(fp, now) ? merchant : undefined),
  isRegisteredOrigin: (origin) => Promise.resolve(merchant.allowsOrigin(origin)),
};
const clock = { now: () => TEST_NOW };

describe("DefaultNoticeKeyResolver", () => {
  it("a registered notice key resolves the merchant", async () => {
    const resolver = new DefaultNoticeKeyResolver({ merchants, minter: fakeMinter, clock });
    expect(await resolver.resolve("notice-a-1")).toEqual({ ok: true, value: merchant });
  });

  it("an unknown key, an ingest key or a platform key → Unauthorized", async () => {
    const resolver = new DefaultNoticeKeyResolver({ merchants, minter: fakeMinter, clock });
    for (const key of ["nope", "key-a-1", "platform-a-1"]) {
      const result = await resolver.resolve(key);
      expect(result.ok ? undefined : result.error, key).toBeInstanceOf(Unauthorized);
    }
  });

  it("a missing or empty key is unauthorized before the minter fingerprints anything", async () => {
    const untouchable = new DefaultNoticeKeyResolver({
      merchants,
      minter: {
        ...fakeMinter,
        fingerprintOf: () => Promise.reject(new Error("the minter must not see an absent key")),
      },
      clock,
    });
    for (const key of [undefined, ""]) {
      expect(await untouchable.resolve(key)).toMatchObject({ ok: false, error: { code: "unauthorized" } });
    }
  });
});
