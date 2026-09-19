// The platform signature as an adapter computes it (ADR-029, contracts/platform-signature.md):
// `X-OPE-Timestamp` in seconds and `X-OPE-Signature` = v1= + hex HMAC-SHA256(secret, "<ts>.<body>").
import { createHmac } from "node:crypto";

/** The two signature headers for `body` (the exact text that will be sent), lowercase. */
export function signed(body: string, secret: string, at: Date): Record<string, string> {
  const timestamp = String(Math.floor(at.getTime() / 1000));
  const digest = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return { "x-ope-timestamp": timestamp, "x-ope-signature": `v1=${digest}` };
}
