// SHA-256 of a token with Node's crypto (ADR-031): the only fingerprint the platform stores.
import { createHash } from "node:crypto";
import type { TokenFingerprinter } from "../../../application/access/index.js";

export const nodeTokenFingerprinter: TokenFingerprinter = {
  fingerprintOf(token) {
    return Promise.resolve(createHash("sha256").update(token, "utf8").digest("hex"));
  },
};
