// Platform signature (ADR-029): `v1=<hex HMAC-SHA256>` over `<timestamp>.<raw body>`, keyed
// with a signing secret of the merchant. The domain parses the header, compares digests in
// constant time and judges the timestamp window; the HMAC itself is computed behind a port.
import { MS_PER_SECOND } from "../shared-kernel/index.js";

const SCHEME = "v1=";
const HEX_DIGEST = /^[0-9a-f]{64}$/;

export class PlatformSignature {
  /** The lowercase hex digest the header carries. */
  readonly digest: string;

  private constructor(digest: string) {
    this.digest = digest;
  }

  /** The header as the platform sent it; undefined when it is not `v1=` plus 64 lowercase hex characters. */
  static parse(header: string): PlatformSignature | undefined {
    if (!header.startsWith(SCHEME)) return undefined;
    const digest = header.slice(SCHEME.length);
    return HEX_DIGEST.test(digest) ? new PlatformSignature(digest) : undefined;
  }

  /** The message the platform signed: the timestamp, a dot, and the body bytes as sent. */
  static message(timestamp: number, body: Uint8Array): Uint8Array {
    const prefix = new TextEncoder().encode(`${String(timestamp)}.`);
    const out = new Uint8Array(prefix.length + body.length);
    out.set(prefix, 0);
    out.set(body, prefix.length);
    return out;
  }

  /** The header timestamp as the platform sent it: an integer number of seconds, or undefined. */
  static timestampOf(header: string): number | undefined {
    return /^\d{1,12}$/.test(header) ? Number(header) : undefined;
  }

  /** Whether the signing instant is within `windowMs` of `now`, either way. */
  static inWindow(timestamp: number, now: Date, windowMs: number): boolean {
    return Math.abs(now.getTime() - timestamp * MS_PER_SECOND) <= windowMs;
  }

  /** Constant-time comparison with an expected digest: the time taken does not depend on where they differ. */
  matches(expectedDigest: string): boolean {
    if (expectedDigest.length !== this.digest.length) return false;
    // Hex digits only: char codes compare one to one, and every position is visited.
    const difference = Array.from(
      this.digest,
      (char, i) => char.charCodeAt(0) ^ expectedDigest.charCodeAt(i),
    ).reduce((acc, bits) => acc | bits, 0);
    return difference === 0;
  }
}
