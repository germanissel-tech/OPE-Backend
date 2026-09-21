// Random identifiers with the crypto of Node (ADR-031): a prefix that says what the value is
// and lowercase base32 characters, one random byte each (256 is a multiple of 32: no bias).
import { randomBytes } from "node:crypto";

const ID_LENGTH = 12;
const CHAR_MASK = 31;
const BASE32 = "abcdefghijklmnopqrstuvwxyz234567";

/** `<prefix>` + 12 random lowercase base32 characters. */
export function randomId(prefix: string): string {
  const chars = Array.from(randomBytes(ID_LENGTH), (byte) => BASE32.charAt(byte & CHAR_MASK));
  return `${prefix}${chars.join("")}`;
}
