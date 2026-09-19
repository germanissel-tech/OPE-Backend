// US5 (FR-017, FR-040; ADR-014) and ADR-024: merchant rules live in the Merchant — origins are
// parsed once at construction and compared canonically; credentials are matched exactly.
import { describe, expect, it } from "vitest";
import {
  InvalidIngestKeys,
  InvalidOrigin,
  InvalidOrigins,
  InvalidPlatformKeys,
  InvalidPlatformSecrets,
  Merchant,
  Origin,
  PlatformKeyCollision,
} from "../../../../src/domain/merchant/index.js";
import { asMerchantId } from "../../../../src/domain/shared-kernel/index.js";

function merchantOf(origins: string[], ingestKeys = ["key-a-1", "key-a-2"]): Merchant {
  const built = Merchant.of({ merchantId: asMerchantId("m_a"), ingestKeys, origins });
  if (!built.ok) throw new Error(built.error.message);
  return built.value;
}

const merchant = merchantOf(["https://a.example", "https://Shop.A.example:8443"]);

describe("Merchant.of", () => {
  it("parses every origin once into its canonical form", () => {
    expect(merchant.origins.map((o) => o.value)).toEqual([
      "https://a.example",
      "https://shop.a.example:8443",
    ]);
  });

  it("[invariant] an origin that is not scheme://host[:port] rejects the merchant, naming its index", () => {
    const built = Merchant.of({
      merchantId: asMerchantId("m_a"),
      ingestKeys: ["k"],
      origins: ["https://a.example", "not an origin"],
    });
    expect(built).toMatchObject({
      ok: false,
      error: { code: "invalid-origin", module: "merchant", details: { index: 1 } },
    });
    if (!built.ok) expect(built.error).toBeInstanceOf(InvalidOrigin);
  });

  it("rehydrate trusts recorded facts and does not re-judge them", () => {
    const origin = Origin.parse("https://a.example");
    if (!origin) throw new Error("origin");
    const back = Merchant.rehydrate({
      merchantId: asMerchantId("m_a"),
      ingestKeys: ["k"],
      origins: [origin],
      platformKeys: [],
      platformSecrets: [],
    });
    expect(back.owns("k")).toBe(true);
    expect(back.allowsOrigin("https://A.EXAMPLE")).toBe(true);
  });
});

describe("Merchant.allowsOrigin", () => {
  it("accepts the exact registered origin (scheme + host + port)", () => {
    expect(merchant.allowsOrigin("https://a.example")).toBe(true);
    expect(merchant.allowsOrigin("https://shop.a.example:8443")).toBe(true);
  });

  it("the host is compared case-insensitively; scheme and port do count", () => {
    expect(merchant.allowsOrigin("https://A.EXAMPLE")).toBe(true);
    expect(merchant.allowsOrigin("http://a.example")).toBe(false);
    expect(merchant.allowsOrigin("https://a.example:8443")).toBe(false);
  });

  it("accepts neither subdomains, paths nor origins of another merchant", () => {
    expect(merchant.allowsOrigin("https://evil.a.example")).toBe(false);
    expect(merchant.allowsOrigin("https://a.example/checkout")).toBe(false);
    expect(merchant.allowsOrigin("https://b.example")).toBe(false);
    expect(merchant.allowsOrigin("null")).toBe(false);
  });

  it("without Origin (server to server, tests) it is allowed: the control is the credential/origin pair", () => {
    expect(merchant.allowsOrigin(undefined)).toBe(true);
  });
});

describe("Merchant.owns", () => {
  it("either of the two active keys belongs to the merchant (rotation, FR-017)", () => {
    expect(merchant.owns("key-a-1")).toBe(true);
    expect(merchant.owns("key-a-2")).toBe(true);
  });

  it("an unknown, empty or differently cased key belongs to nobody", () => {
    expect(merchant.owns("key-c-1")).toBe(false);
    expect(merchant.owns("")).toBe(false);
    expect(merchant.owns("KEY-A-1")).toBe(false);
  });

  it("an empty key belongs to nobody even if a recorded merchant lists one", () => {
    const origin = Origin.parse("https://a.example");
    if (!origin) throw new Error("origin");
    const odd = Merchant.rehydrate({
      merchantId: asMerchantId("m_odd"),
      ingestKeys: [""],
      origins: [origin],
      platformKeys: [],
      platformSecrets: [],
    });
    expect(odd.owns("")).toBe(false);
  });
});

describe("Origin.parse", () => {
  it("canonicalises scheme and authority and trims; anything else is undefined", () => {
    expect(Origin.parse(" HTTPS://Shop.Example:8443 ")?.value).toBe("https://shop.example:8443");
    expect(Origin.parse("https://a.example/")).toBeUndefined();
    expect(Origin.parse("evil https://a.example")).toBeUndefined();
    expect(Origin.parse("a.example")).toBeUndefined();
    expect(Origin.parse("")).toBeUndefined();
  });

  it("equals compares by canonical value", () => {
    const a = Origin.parse("https://A.example");
    const b = Origin.parse("https://a.EXAMPLE");
    const c = Origin.parse("http://a.example");
    expect(a && b && a.equals(b)).toBe(true);
    expect(a && c && a.equals(c)).toBe(false);
  });
});

describe("Merchant credential sets (ADR-024: the owner judges them, F-007 of the audit 014)", () => {
  const build = (over: Partial<Parameters<typeof Merchant.of>[0]>) =>
    Merchant.of({
      merchantId: asMerchantId("m_a"),
      ingestKeys: ["key-a-1"],
      origins: ["https://a.example"],
      ...over,
    });

  it("[invariant:invalid-ingest-keys] zero, three, or an empty ingest key reject the merchant", () => {
    expect(build({ ingestKeys: [] })).toMatchObject({ ok: false, error: { code: "invalid-ingest-keys" } });
    expect(build({ ingestKeys: ["a", "b", "c"] })).toMatchObject({
      ok: false,
      error: { code: "invalid-ingest-keys" },
    });
    const empty = build({ ingestKeys: ["a", ""] });
    expect(empty).toMatchObject({ ok: false, error: { code: "invalid-ingest-keys", details: { index: 1 } } });
    if (!empty.ok) expect(empty.error).toBeInstanceOf(InvalidIngestKeys);
    expect(build({ ingestKeys: ["a", "b"] }).ok).toBe(true);
  });

  it("[invariant:invalid-origins] no origin at all rejects the merchant", () => {
    const none = build({ origins: [] });
    expect(none).toMatchObject({ ok: false, error: { code: "invalid-origins" } });
    if (!none.ok) expect(none.error).toBeInstanceOf(InvalidOrigins);
  });

  it("[invariant:invalid-platform-keys] more than two platform keys reject the merchant", () => {
    const three = build({ platformKeys: ["p1", "p2", "p3"] });
    expect(three).toMatchObject({ ok: false, error: { code: "invalid-platform-keys" } });
    if (!three.ok) expect(three.error).toBeInstanceOf(InvalidPlatformKeys);
    expect(build({ platformKeys: ["p1", "p2"] }).ok).toBe(true);
  });

  it("[invariant:invalid-platform-secrets] more than two signing secrets reject the merchant", () => {
    const three = build({ platformKeys: ["p1"], platformSecrets: ["s1", "s2", "s3"] });
    expect(three).toMatchObject({ ok: false, error: { code: "invalid-platform-secrets" } });
    if (!three.ok) expect(three.error).toBeInstanceOf(InvalidPlatformSecrets);
  });

  it("rehydrate does not judge the sets: a recorded merchant with three keys comes back as recorded", () => {
    const recorded = Merchant.rehydrate({
      merchantId: asMerchantId("m_a"),
      ingestKeys: ["a", "b", "c"],
      origins: [],
      platformKeys: [],
      platformSecrets: [],
    });
    expect(recorded.ingestKeys).toEqual(["a", "b", "c"]);
  });

  it("ownsPlatformKey compares in constant time: a long shared prefix is as foreign as a different first character", () => {
    const real = "k".repeat(63) + "a";
    const built = build({ platformKeys: [real] });
    if (!built.ok) throw new Error(built.error.message);
    expect(built.value.ownsPlatformKey(real)).toBe(true);
    expect(built.value.ownsPlatformKey("k".repeat(63) + "b")).toBe(false);
    expect(built.value.ownsPlatformKey("x" + "k".repeat(63))).toBe(false);
    expect(built.value.ownsPlatformKey("")).toBe(false);
  });
});

describe("Merchant platform keys (ADR-025)", () => {
  const build = (platformKeys: string[]) =>
    Merchant.of({
      merchantId: asMerchantId("m_a"),
      ingestKeys: ["key-a-1"],
      origins: ["https://a.example"],
      platformKeys,
    });

  it("a merchant without platform keys owns none; with them, exactly those", () => {
    const none = build([]);
    const some = build(["platform-a-1", "platform-a-2"]);
    if (!none.ok || !some.ok) throw new Error("build");
    expect(none.value.platformKeys).toEqual([]);
    const omitted = Merchant.of({
      merchantId: asMerchantId("m_a"),
      ingestKeys: ["key-a-1"],
      origins: ["https://a.example"],
    });
    expect(omitted.ok && omitted.value.platformKeys).toEqual([]);
    expect(none.value.ownsPlatformKey("platform-a-1")).toBe(false);
    expect(some.value.ownsPlatformKey("platform-a-1")).toBe(true);
    expect(some.value.ownsPlatformKey("platform-a-2")).toBe(true);
    expect(some.value.ownsPlatformKey("key-a-1")).toBe(false);
    expect(some.value.ownsPlatformKey("")).toBe(false);
  });

  it("[invariant] a platform key equal to an ingest key, or empty, rejects the merchant naming its index", () => {
    const collision = build(["platform-a-1", "key-a-1"]);
    expect(collision).toMatchObject({
      ok: false,
      error: { code: "platform-key-collision", details: { index: 1 } },
    });
    if (!collision.ok) expect(collision.error).toBeInstanceOf(PlatformKeyCollision);
    expect(build([""])).toMatchObject({
      ok: false,
      error: { code: "platform-key-collision", details: { index: 0 } },
    });
  });

  it("an empty platform key belongs to nobody even if a recorded merchant lists one", () => {
    const origin = Origin.parse("https://a.example");
    if (!origin) throw new Error("origin");
    const odd = Merchant.rehydrate({
      merchantId: asMerchantId("m_odd"),
      ingestKeys: ["k"],
      origins: [origin],
      platformKeys: [""],
      platformSecrets: [],
    });
    expect(odd.ownsPlatformKey("")).toBe(false);
  });

  it("an ingest key never authenticates as a platform key, nor the other way round", () => {
    const built = build(["platform-a-1"]);
    if (!built.ok) throw new Error("build");
    expect(built.value.owns("platform-a-1")).toBe(false);
    expect(built.value.ownsPlatformKey("key-a-1")).toBe(false);
  });
});
