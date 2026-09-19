// Feature 013, user story 6 (FR-050..FR-053; ADR-029): the signature value — parsing `v1=`,
// the signed message, the window and the constant-time comparison — and the merchant's secrets.
import { describe, expect, it } from "vitest";
import { InvalidPlatformSecret, Merchant, PlatformSignature } from "../../../../src/domain/merchant/index.js";
import { asMerchantId } from "../../../../src/domain/shared-kernel/index.js";

const HEX = "a".repeat(64);
const NOW = new Date("2026-09-19T12:00:00.000Z");
const WINDOW_MS = 300_000;

describe("PlatformSignature.parse", () => {
  it.each<[string, string | undefined]>([
    [`v1=${HEX}`, HEX],
    [`v1=${"0123456789abcdef".repeat(4)}`, "0123456789abcdef".repeat(4)],
    [`v2=${HEX}`, undefined],
    [HEX, undefined],
    [`v1=${HEX.toUpperCase()}`, undefined],
    [`v1=${"a".repeat(63)}`, undefined],
    [`v1=${"a".repeat(65)}`, undefined],
    ["v1=", undefined],
    ["", undefined],
  ])("%s → %s", (header, digest) => {
    expect(PlatformSignature.parse(header)?.digest).toBe(digest);
  });
});

describe("PlatformSignature.timestampOf", () => {
  it.each<[string, number | undefined]>([
    ["1789819200", 1789819200],
    ["0", 0],
    ["-1", undefined],
    ["1.5", undefined],
    ["17898192001789819200", undefined],
    ["abc", undefined],
    ["", undefined],
    [" 1789819200", undefined],
  ])("%s → %s", (header, value) => {
    expect(PlatformSignature.timestampOf(header)).toBe(value);
  });
});

describe("PlatformSignature.message and inWindow", () => {
  it("the message is the timestamp, a dot and the body bytes, untouched", () => {
    const body = new Uint8Array([123, 34, 97, 34, 58, 34, 195, 169, 34, 125]);
    const message = PlatformSignature.message(1789819200, body);
    expect(message.slice(11)).toEqual(body);
    expect(new TextDecoder().decode(message.slice(0, 11))).toBe("1789819200.");
    expect(message.length).toBe(11 + body.length);
    expect(PlatformSignature.message(5, new Uint8Array())).toEqual(new TextEncoder().encode("5."));
  });

  it("a timestamp within the window either way is fine; exactly at the edge too; beyond, not", () => {
    const seconds = Math.floor(NOW.getTime() / 1000);
    expect(PlatformSignature.inWindow(seconds, NOW, WINDOW_MS)).toBe(true);
    expect(PlatformSignature.inWindow(seconds - 300, NOW, WINDOW_MS)).toBe(true);
    expect(PlatformSignature.inWindow(seconds + 300, NOW, WINDOW_MS)).toBe(true);
    expect(PlatformSignature.inWindow(seconds - 301, NOW, WINDOW_MS)).toBe(false);
    expect(PlatformSignature.inWindow(seconds + 301, NOW, WINDOW_MS)).toBe(false);
  });
});

describe("PlatformSignature.matches", () => {
  const signature = PlatformSignature.parse(`v1=${HEX}`);
  if (signature === undefined) throw new Error("signature");

  it("true only for the same digest; a different length or a different character anywhere is false", () => {
    expect(signature.matches(HEX)).toBe(true);
    expect(signature.matches(`${"a".repeat(63)}b`)).toBe(false);
    expect(signature.matches(`b${"a".repeat(63)}`)).toBe(false);
    expect(signature.matches("a".repeat(63))).toBe(false);
    expect(signature.matches("a".repeat(65))).toBe(false);
    expect(signature.matches("")).toBe(false);
  });
});

describe("Merchant.platformSecrets (ADR-029)", () => {
  const build = (platformSecrets?: string[]) =>
    Merchant.of({
      merchantId: asMerchantId("m_a"),
      ingestKeys: ["key-a-1"],
      origins: ["https://a.example"],
      platformKeys: ["platform-a-1"],
      ...(platformSecrets === undefined ? {} : { platformSecrets }),
    });

  it("without secrets no signature is required; with one or two, it is", () => {
    const none = build();
    const empty = build([]);
    const two = build(["s1", "s2"]);
    if (!none.ok || !empty.ok || !two.ok) throw new Error("build");
    expect(none.value.platformSecrets).toEqual([]);
    expect(none.value.requiresSignature()).toBe(false);
    expect(empty.value.requiresSignature()).toBe(false);
    expect(two.value.platformSecrets).toEqual(["s1", "s2"]);
    expect(two.value.requiresSignature()).toBe(true);
  });

  it.each<[string, string[], number]>([
    ["an empty secret", ["s1", ""], 1],
    ["a secret equal to an ingest key", ["key-a-1"], 0],
    ["a secret equal to a platform key", ["s1", "platform-a-1"], 1],
  ])("%s rejects the merchant naming its index", (_name, secrets, index) => {
    const built = build(secrets);
    expect(built).toMatchObject({
      ok: false,
      error: { code: "invalid-platform-secret", details: { index } },
    });
    if (!built.ok) expect(built.error).toBeInstanceOf(InvalidPlatformSecret);
  });

  it("a secret is judged after the keys: a bad key wins", () => {
    const built = Merchant.of({
      merchantId: asMerchantId("m_a"),
      ingestKeys: ["key-a-1"],
      origins: ["https://a.example"],
      platformKeys: [""],
      platformSecrets: [""],
    });
    expect(built.ok ? undefined : built.error.code).toBe("platform-key-collision");
  });
});
