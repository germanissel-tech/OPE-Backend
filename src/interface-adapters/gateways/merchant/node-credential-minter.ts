// Credentials and identifiers with the crypto of Node (ADR-031): 32 random bytes in base64url
// with a prefix that says what the value is, SHA-256 hex as the fingerprint, and `mrc_` + 12
// lowercase base32 characters (one random byte each) as the merchant identifier.
import { createHash, randomBytes } from "node:crypto";
import { asMerchantId } from "../../../domain/shared-kernel/index.js";
import type { CredentialMinter } from "../../../application/merchant/index.js";
import type { CredentialKind } from "../../../domain/merchant/index.js";

const VALUE_BYTES = 32;
const ID_LENGTH = 12;
const CHAR_MASK = 31;
const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";
const PREFIX: Readonly<Record<CredentialKind, string>> = {
  ingest: "ope_ik_",
  platform: "ope_pk_",
  signing: "ope_ps_",
};

const fingerprintOf = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");

/** One lowercase base32 character per random byte (256 is a multiple of 32: no bias). */
function base32Id(): string {
  return Array.from(randomBytes(ID_LENGTH), (byte) => BASE32.charAt(byte & CHAR_MASK)).join("");
}

export const nodeCredentialMinter: CredentialMinter = {
  mint(kind) {
    const value = `${PREFIX[kind]}${randomBytes(VALUE_BYTES).toString("base64url")}`;
    return Promise.resolve({ value, fingerprint: fingerprintOf(value) });
  },
  fingerprintOf(value) {
    return Promise.resolve(fingerprintOf(value));
  },
  mintMerchantId() {
    return Promise.resolve(asMerchantId(`mrc_${base32Id()}`));
  },
};
