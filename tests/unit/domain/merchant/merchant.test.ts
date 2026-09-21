// Feature 004, US5 (FR-017, FR-040; ADR-014), ADR-024 and feature 017 (ADR-031): merchant rules
// live in the Merchant — origins are parsed once and compared canonically; credentials are
// kept by fingerprint, matched at an instant, at most two live per kind; the status rules.
import { describe, expect, it } from "vitest";
import {
  InvalidIngestKeys,
  InvalidOrigin,
  InvalidOrigins,
  InvalidPlatformKeys,
  InvalidPlatformSecret,
  InvalidPlatformSecrets,
  Merchant,
  Origin,
  PlatformKeyCollision,
  type Credential,
  type MerchantInput,
} from "../../../../src/domain/merchant/index.js";
import { asMerchantId } from "../../../../src/domain/shared-kernel/index.js";

const NOW = new Date("2026-09-20T12:00:00.000Z");
const LATER = (ms: number) => new Date(NOW.getTime() + ms);
const HOUR = 3_600_000;
const GRACE = { graceMs: HOUR, maxGraceMs: 7 * 24 * HOUR };

const ingest = (fingerprint: string, issuedAt = NOW): Credential =>
  Merchant.credential("ingest", fingerprint, issuedAt);
const platform = (fingerprint: string): Credential => Merchant.credential("platform", fingerprint, NOW);
const signing = (secret: string): Credential => Merchant.credential("signing", `fp:${secret}`, NOW, secret);

function inputOf(over: Partial<MerchantInput> = {}): MerchantInput {
  return {
    merchantId: asMerchantId("m_a"),
    origins: ["https://a.example", "https://Shop.A.example:8443"],
    credentials: [ingest("k1"), ingest("k2")],
    createdAt: NOW,
    ...over,
  };
}

function merchantOf(over: Partial<MerchantInput> = {}): Merchant {
  const built = Merchant.of(inputOf(over));
  if (!built.ok) throw new Error(built.error.message);
  return built.value;
}

const merchant = merchantOf();

describe("Merchant.of", () => {
  it("parses every origin once into its canonical form; active by default; keeps the instant", () => {
    expect(merchant.origins.map((o) => o.value)).toEqual([
      "https://a.example",
      "https://shop.a.example:8443",
    ]);
    expect(merchant.status).toBe("active");
    expect(merchant.createdAt).toEqual(NOW);
    expect(merchant.isOn()).toBe(true);
  });

  it("[invariant:invalid-origin] an origin that is not scheme://host[:port] rejects the merchant, naming its index", () => {
    const built = Merchant.of(inputOf({ origins: ["https://a.example", "not an origin"] }));
    expect(built).toMatchObject({
      ok: false,
      error: { code: "invalid-origin", module: "merchant", details: { index: 1 } },
    });
    if (!built.ok) expect(built.error).toBeInstanceOf(InvalidOrigin);
  });

  it("[invariant:invalid-origins] no origin at all rejects the merchant", () => {
    const built = Merchant.of(inputOf({ origins: [] }));
    expect(built.ok ? undefined : built.error).toBeInstanceOf(InvalidOrigins);
  });

  it("rehydrate trusts recorded facts and does not re-judge them", () => {
    const origin = Origin.parse("https://a.example");
    if (!origin) throw new Error("origin");
    const back = Merchant.rehydrate({
      merchantId: asMerchantId("m_a"),
      status: "off",
      origins: [origin],
      credentials: [ingest("k"), ingest("k2"), ingest("k3")],
      createdAt: NOW,
    });
    expect(back.owns("k", NOW)).toBe(true);
    expect(back.isOn()).toBe(false);
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
    expect(merchant.allowsOrigin("https://a.example:444")).toBe(false);
  });

  it("accepts neither subdomains, paths nor origins of another merchant", () => {
    expect(merchant.allowsOrigin("https://www.a.example")).toBe(false);
    expect(merchant.allowsOrigin("https://a.example/path")).toBe(false);
    expect(merchant.allowsOrigin("https://b.example")).toBe(false);
  });

  it("without Origin (server to server, tests) it is allowed: the control is the credential/origin pair", () => {
    expect(merchant.allowsOrigin(undefined)).toBe(true);
  });
});

describe("Merchant.owns / ownsPlatformKey (by fingerprint, at an instant)", () => {
  it("either of the two live ingest fingerprints belongs to the merchant (rotation, FR-017)", () => {
    expect(merchant.owns("k1", NOW)).toBe(true);
    expect(merchant.owns("k2", NOW)).toBe(true);
  });

  it("an unknown, empty or differently cased fingerprint belongs to nobody", () => {
    expect(merchant.owns("K1", NOW)).toBe(false);
    expect(merchant.owns("", NOW)).toBe(false);
    expect(merchant.owns("k3", NOW)).toBe(false);
  });

  it("an expired credential belongs to nobody; one expiring exactly now has expired", () => {
    const m = Merchant.rehydrate({
      ...merchant.record(),
      credentials: [
        { ...ingest("old"), expiresAt: NOW },
        { ...ingest("soon"), expiresAt: LATER(1) },
      ],
    });
    expect(m.owns("old", NOW)).toBe(false);
    expect(m.owns("soon", NOW)).toBe(true);
    expect(m.owns("soon", LATER(1))).toBe(false);
    expect(m.credentialsOf("ingest", NOW).map((c) => c.fingerprint)).toEqual(["soon"]);
  });

  it("a deactivated merchant owns nothing", () => {
    const m = merchantOf({ credentials: [ingest("k1"), platform("p1")] }).deactivated();
    expect(m.owns("k1", NOW)).toBe(false);
    expect(m.ownsPlatformKey("p1", NOW)).toBe(false);
    expect(m.isDeactivated()).toBe(true);
  });

  it("a platform fingerprint never authenticates as ingest, nor the other way round", () => {
    const m = merchantOf({ credentials: [ingest("k1"), platform("p1")] });
    expect(m.ownsPlatformKey("p1", NOW)).toBe(true);
    expect(m.ownsPlatformKey("k1", NOW)).toBe(false);
    expect(m.owns("p1", NOW)).toBe(false);
    expect(m.ownsPlatformKey("", NOW)).toBe(false);
  });

  it("ownsPlatformKey compares in constant time: a long shared prefix is as foreign as a different first character", () => {
    const shared = "a".repeat(63);
    const m = merchantOf({ credentials: [ingest("k1"), platform(`${shared}b`)] });
    expect(m.ownsPlatformKey(`${shared}b`, NOW)).toBe(true);
    expect(m.ownsPlatformKey(`${shared}c`, NOW)).toBe(false);
    expect(m.ownsPlatformKey(`z${shared}`, NOW)).toBe(false);
  });
});

describe("Merchant.credential", () => {
  it("carries the secret only when there is one: an ingest credential has no secret key at all", () => {
    expect(Merchant.credential("ingest", "fp", NOW)).toStrictEqual({
      kind: "ingest",
      fingerprint: "fp",
      issuedAt: NOW,
    });
    expect(Merchant.credential("signing", "fp", NOW, "s")).toStrictEqual({
      kind: "signing",
      fingerprint: "fp",
      issuedAt: NOW,
      secret: "s",
    });
  });
});

describe("Merchant signing secrets (ADR-029)", () => {
  it("a recorded signing credential without its secret signs nothing and requires no signature", () => {
    const back = Merchant.rehydrate({
      ...merchant.record(),
      credentials: [ingest("k"), Merchant.credential("signing", "fp", NOW)],
    });
    expect(back.signingSecrets(NOW)).toEqual([]);
    expect(back.requiresSignature(NOW)).toBe(false);
  });

  it("with a live signing secret every platform request must be signed; the secrets are the live ones", () => {
    const m = merchantOf({
      credentials: [ingest("k1"), signing("s1"), { ...signing("s0"), expiresAt: NOW }],
    });
    expect(m.requiresSignature(NOW)).toBe(true);
    expect(m.signingSecrets(NOW)).toEqual(["s1"]);
    expect(merchant.requiresSignature(NOW)).toBe(false);
  });
});

describe("Merchant credential sets (ADR-024: the owner judges them)", () => {
  it("[invariant:invalid-ingest-keys] zero or three ingest credentials, or an empty fingerprint, reject the merchant", () => {
    expect(Merchant.of(inputOf({ credentials: [] })).ok ? undefined : "no").toBe("no");
    const onlyPlatform = Merchant.of(inputOf({ credentials: [platform("p")] }));
    expect(onlyPlatform.ok ? undefined : onlyPlatform.error).toBeInstanceOf(InvalidIngestKeys);
    const three = Merchant.of(inputOf({ credentials: [ingest("a"), ingest("b"), ingest("c")] }));
    expect(three.ok ? undefined : three.error).toBeInstanceOf(InvalidIngestKeys);
    const blank = Merchant.of(inputOf({ credentials: [ingest("a"), ingest("")] }));
    expect(blank.ok ? undefined : [blank.error.code, blank.error.details]).toEqual([
      "invalid-ingest-keys",
      { index: 1 },
    ]);
  });

  it("[invariant:invalid-platform-keys] more than two platform credentials reject the merchant", () => {
    const built = Merchant.of(
      inputOf({ credentials: [ingest("k"), platform("p1"), platform("p2"), platform("p3")] }),
    );
    expect(built.ok ? undefined : built.error).toBeInstanceOf(InvalidPlatformKeys);
  });

  it("[invariant:invalid-platform-secret] a signing credential without its secret, or with an empty one, is refused naming its index", () => {
    const empty = Merchant.of(inputOf({ credentials: [ingest("k"), signing("")] }));
    expect(empty.ok ? undefined : [empty.error.code, empty.error.details]).toEqual([
      "invalid-platform-secret",
      { index: 1 },
    ]);
    const missing = Merchant.of(
      inputOf({ credentials: [ingest("k"), Merchant.credential("signing", "fp:none", NOW)] }),
    );
    expect(missing.ok ? undefined : missing.error.code).toBe("invalid-platform-secret");
  });

  it("[invariant:invalid-platform-secrets] more than two signing secrets reject the merchant", () => {
    const built = Merchant.of(
      inputOf({ credentials: [ingest("k"), signing("a"), signing("b"), signing("c")] }),
    );
    expect(built.ok ? undefined : built.error).toBeInstanceOf(InvalidPlatformSecrets);
  });

  it("[invariant] a fingerprint shared across kinds, or an empty platform fingerprint, is a collision naming its index", () => {
    const shared = Merchant.of(inputOf({ credentials: [ingest("same"), platform("same")] }));
    expect(shared.ok ? undefined : [shared.error.constructor, shared.error.details]).toEqual([
      PlatformKeyCollision,
      { index: 1 },
    ]);
    const empty = Merchant.of(inputOf({ credentials: [ingest("k"), platform("")] }));
    expect(empty.ok ? undefined : empty.error).toBeInstanceOf(PlatformKeyCollision);
  });

  it("[invariant] a signing credential without its secret, or with an empty one, rejects the merchant", () => {
    const missing = Merchant.of(
      inputOf({ credentials: [ingest("k"), Merchant.credential("signing", "fp", NOW)] }),
    );
    expect(missing.ok ? undefined : [missing.error.constructor, missing.error.details]).toEqual([
      InvalidPlatformSecret,
      { index: 1 },
    ]);
    const empty = Merchant.of(
      inputOf({ credentials: [ingest("k"), Merchant.credential("signing", "", NOW, "")] }),
    );
    expect(empty.ok ? undefined : empty.error).toBeInstanceOf(InvalidPlatformSecret);
  });
});

describe("Merchant.rotated (ADR-014, ADR-031)", () => {
  it("adds the new credential; the previous one expires after the grace; the response keeps the rest", () => {
    const m = merchantOf({ credentials: [ingest("k1"), platform("p1")] });
    const rotated = m.rotated(ingest("k2", NOW), GRACE, NOW);
    if (!rotated.ok) throw new Error(rotated.error.code);
    expect(rotated.value.credentialsOf("ingest", NOW).map((c) => c.fingerprint)).toEqual(["k1", "k2"]);
    expect(rotated.value.credentialsOf("ingest", LATER(HOUR)).map((c) => c.fingerprint)).toEqual(["k2"]);
    expect(rotated.value.ownsPlatformKey("p1", LATER(HOUR))).toBe(true);
    expect(m.owns("k2", NOW)).toBe(false);
  });

  it("with no grace the previous credential is refused at once", () => {
    const rotated = merchantOf({ credentials: [ingest("k1")] }).rotated(
      ingest("k2"),
      { ...GRACE, graceMs: 0 },
      NOW,
    );
    if (!rotated.ok) throw new Error(rotated.error.code);
    expect(rotated.value.owns("k1", NOW)).toBe(false);
    expect(rotated.value.owns("k2", NOW)).toBe(true);
  });

  it("a rotation while two are live expires the older one now and gives the grace to the newer", () => {
    const m = merchantOf({ credentials: [ingest("old", LATER(-2 * HOUR)), ingest("mid", LATER(-HOUR))] });
    const rotated = m.rotated(ingest("new"), GRACE, NOW);
    if (!rotated.ok) throw new Error(rotated.error.code);
    expect(rotated.value.owns("old", NOW)).toBe(false);
    expect(rotated.value.owns("mid", NOW)).toBe(true);
    expect(rotated.value.owns("mid", LATER(HOUR))).toBe(false);
    expect(rotated.value.owns("new", LATER(HOUR))).toBe(true);
    expect(rotated.value.credentials).toHaveLength(3);
  });

  it.each([
    ["older first", [ingest("old", LATER(-2 * HOUR)), ingest("mid", LATER(-HOUR))]],
    ["newer first", [ingest("mid", LATER(-HOUR)), ingest("old", LATER(-2 * HOUR))]],
  ])("with two live the older one expires now whatever the order of the record (%s)", (_, credentials) => {
    const rotated = merchantOf({ credentials }).rotated(ingest("new"), GRACE, NOW);
    if (!rotated.ok) throw new Error(rotated.error.code);
    expect(rotated.value.credentialsOf("ingest", LATER(1)).map((c) => c.fingerprint)).toEqual(["mid", "new"]);
  });

  it("[invariant:rotation-grace-too-long] a grace beyond the platform maximum is refused", () => {
    const rotated = merchant.rotated(ingest("k3"), { graceMs: HOUR + 1, maxGraceMs: HOUR }, NOW);
    expect(rotated.ok ? undefined : [rotated.error.code, rotated.error.details]).toEqual([
      "rotation-grace-too-long",
      { maxGraceMs: HOUR },
    ]);
  });

  it("a deactivated merchant cannot rotate nor switch; deactivating again changes nothing", () => {
    const gone = merchant.deactivated();
    expect(gone.rotated(ingest("k3"), GRACE, NOW).ok ? undefined : "merchant-deactivated").toBe(
      "merchant-deactivated",
    );
    const switched = gone.switched(true);
    expect(switched.ok ? undefined : switched.error.code).toBe("merchant-deactivated");
    expect(gone.deactivated().status).toBe("deactivated");
  });
});

describe("Merchant.switched", () => {
  it("off stops deciding and on resumes; the record survives the round trip", () => {
    const off = merchant.switched(false);
    if (!off.ok) throw new Error(off.error.code);
    expect(off.value.isOn()).toBe(false);
    expect(off.value.status).toBe("off");
    const on = off.value.switched(true);
    expect(on.ok && on.value.isOn()).toBe(true);
    expect(Merchant.rehydrate(off.value.record()).status).toBe("off");
  });
});

describe("Origin.parse", () => {
  it("canonicalises scheme and authority and trims; anything else is undefined", () => {
    expect(Origin.parse("  HTTPS://Shop.Example:8443 ")?.value).toBe("https://shop.example:8443");
    expect(Origin.parse("https://a.example/path")).toBeUndefined();
    expect(Origin.parse("a.example")).toBeUndefined();
    expect(Origin.parse("")).toBeUndefined();
  });

  it("equals compares by canonical value", () => {
    const a = Origin.parse("https://A.example");
    const b = Origin.parse("https://a.example");
    if (!a || !b) throw new Error("origin");
    expect(a.equals(b)).toBe(true);
  });
});
