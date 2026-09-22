// HMAC with Node's crypto (ADR-029). The only place the runtime's crypto is named for the
// platform signature; the domain and the application compare digests without it.
import { createHmac } from "node:crypto";
import type { MessageAuthenticator } from "../../../application/access/index.js";

export const nodeMessageAuthenticator: MessageAuthenticator = {
  hmacSha256Hex(secret, message) {
    return Promise.resolve(createHmac("sha256", secret).update(message).digest("hex"));
  },
};
