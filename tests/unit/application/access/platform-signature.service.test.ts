// Feature 013, user story 6 (FR-050..FR-052; ADR-029): the verifier with a fake authenticator —
// nothing to verify without a secret; missing, malformed, expired or mismatching signatures;
// any of two secrets accepts — and the Node authenticator against a known HMAC-SHA256 vector.
import { describe, expect, it } from "vitest";
import {
  DefaultPlatformSignatureVerifier,
  type MessageAuthenticator,
  type SignedRequest,
} from "../../../../src/application/access/index.js";
import { nodeMessageAuthenticator } from "../../../../src/interface-adapters/access/index.js";
import { testMerchant } from "../../../helpers/merchants.js";
import { TEST_SIGNATURE_WINDOW } from "../../../helpers/platform.js";
import type { Merchant } from "../../../../src/domain/merchant/index.js";

const NOW = new Date("2026-09-19T12:00:00.000Z");
const SECONDS = String(Math.floor(NOW.getTime() / 1000));
const merchantOf = (platformSecrets: string[]): Merchant => {
  return testMerchant({ ingestKeys: ["k"], platformKeys: ["p"], platformSecrets });
};

/** A deterministic "HMAC": the secret, a bar, and the message as text; 64 hex chars are not needed to compare. */
const fakeDigest = (secret: string, message: Uint8Array): string =>
  Buffer.from(`${secret}|${new TextDecoder().decode(message)}`)
    .toString("hex")
    .padEnd(64, "0")
    .slice(0, 64);
const authenticator: MessageAuthenticator = {
  hmacSha256Hex: (secret, message) => Promise.resolve(fakeDigest(secret, message)),
};
const verifier = new DefaultPlatformSignatureVerifier({ authenticator, window: TEST_SIGNATURE_WINDOW });
const body = new TextEncoder().encode('{"orderId":"A-1"}');
const request = (over: Partial<SignedRequest> = {}): SignedRequest => ({
  merchant: merchantOf(["s1", "s2"]),
  timestamp: SECONDS,
  signature: `v1=${fakeDigest("s1", new TextEncoder().encode(`${SECONDS}.{"orderId":"A-1"}`))}`,
  body,
  now: NOW,
  ...over,
});

describe("DefaultPlatformSignatureVerifier", () => {
  it("a merchant without secrets needs no signature, even with headers present or absent", async () => {
    expect(await verifier.verify(request({ merchant: merchantOf([]) }))).toEqual({
      ok: true,
      value: undefined,
    });
    expect(
      await verifier.verify(
        request({ merchant: merchantOf([]), timestamp: undefined, signature: undefined }),
      ),
    ).toEqual({ ok: true, value: undefined });
  });

  it("a valid signature with the first secret, or with the second, is accepted", async () => {
    expect(await verifier.verify(request())).toEqual({ ok: true, value: undefined });
    const second = `v1=${fakeDigest("s2", new TextEncoder().encode(`${SECONDS}.{"orderId":"A-1"}`))}`;
    expect(await verifier.verify(request({ signature: second }))).toEqual({ ok: true, value: undefined });
  });

  it.each<[string, Partial<SignedRequest>, string]>([
    ["no timestamp", { timestamp: undefined }, "signature-missing"],
    ["no signature", { signature: undefined }, "signature-missing"],
    ["a non-numeric timestamp", { timestamp: "now" }, "signature-invalid"],
    ["a malformed signature", { signature: "sha256=abc" }, "signature-invalid"],
    [
      "a timestamp beyond the window in the past",
      { timestamp: String(Number(SECONDS) - 301) },
      "signature-expired",
    ],
    [
      "a timestamp beyond the window in the future",
      { timestamp: String(Number(SECONDS) + 301) },
      "signature-expired",
    ],
    ["a signature of another secret", { signature: `v1=${fakeDigest("other", body)}` }, "signature-invalid"],
    [
      "a signature of another body",
      { body: new TextEncoder().encode('{"orderId":"A-2"}') },
      "signature-invalid",
    ],
    ["a signature of another timestamp", { timestamp: String(Number(SECONDS) - 1) }, "signature-invalid"],
  ])("%s → %s", async (_name, over, code) => {
    const result = await verifier.verify(request(over));
    expect(result.ok ? undefined : result.error.code).toBe(code);
  });

  it("the window is the one the platform declares (level 1 of the configuration): five minutes", () => {
    expect(TEST_SIGNATURE_WINDOW.windowMs()).toBe(5 * 60 * 1000);
  });
});

describe("nodeMessageAuthenticator", () => {
  it("computes HMAC-SHA256 as hex (RFC 4231 test case 1)", async () => {
    const digest = await nodeMessageAuthenticator.hmacSha256Hex(
      "".repeat(20),
      new TextEncoder().encode("Hi There"),
    );
    expect(digest).toBe("b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7");
  });
});
