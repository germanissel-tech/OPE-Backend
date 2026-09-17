// US5 (FR-017, FR-040; ADR-014): pure merchant rules — origins and ingest keys.
import { describe, expect, it } from "vitest";
import { findByIngestKey, originAllowed, type Merchant } from "../../../../src/domain/merchant/index.js";
import { asMerchantId } from "../../../../src/domain/shared-kernel/index.js";

const merchant: Merchant = {
  merchantId: asMerchantId("m_a"),
  ingestKeys: ["key-a-1", "key-a-2"],
  origins: ["https://a.example", "https://Shop.A.example:8443"],
};

describe("originAllowed", () => {
  it("accepts the exact registered origin (scheme + host + port)", () => {
    expect(originAllowed(merchant, "https://a.example")).toBe(true);
    expect(originAllowed(merchant, "https://shop.a.example:8443")).toBe(true);
  });

  it("the host is compared case-insensitively; scheme and port do count", () => {
    expect(originAllowed(merchant, "https://A.EXAMPLE")).toBe(true);
    expect(originAllowed(merchant, "http://a.example")).toBe(false);
    expect(originAllowed(merchant, "https://a.example:8443")).toBe(false);
  });

  it("accepts neither subdomains, paths nor origins of another merchant", () => {
    expect(originAllowed(merchant, "https://evil.a.example")).toBe(false);
    expect(originAllowed(merchant, "https://a.example/checkout")).toBe(false);
    expect(originAllowed(merchant, "https://b.example")).toBe(false);
    expect(originAllowed(merchant, "null")).toBe(false);
  });

  it("without Origin (server to server, tests) it is allowed: the control is the credential/origin pair", () => {
    expect(originAllowed(merchant, undefined)).toBe(true);
  });
});

describe("findByIngestKey", () => {
  const other: Merchant = {
    merchantId: asMerchantId("m_b"),
    ingestKeys: ["key-b-1"],
    origins: ["https://b.example"],
  };
  const all = [merchant, other];

  it("resolves either of the two active keys of the merchant (rotation, FR-017)", () => {
    expect(findByIngestKey(all, "key-a-1")?.merchantId).toBe("m_a");
    expect(findByIngestKey(all, "key-a-2")?.merchantId).toBe("m_a");
    expect(findByIngestKey(all, "key-b-1")?.merchantId).toBe("m_b");
  });

  it("an unknown, empty or differently cased key resolves to nobody", () => {
    expect(findByIngestKey(all, "key-c-1")).toBeUndefined();
    expect(findByIngestKey(all, "")).toBeUndefined();
    expect(findByIngestKey(all, "KEY-A-1")).toBeUndefined();
  });
});
