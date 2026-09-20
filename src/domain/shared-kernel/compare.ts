// Comparison of a secret against a candidate without leaking how far they agree (ADR-029): the
// time spent depends on the lengths, never on the first differing position. Pure TypeScript, so
// the domain can use it for signatures and platform keys without reaching for `node:crypto`.

/** The code unit at `index`, or 0 past the end (`charCodeAt` gives NaN there, and `| 0` reads it as 0). */
const codeAt = (text: string, index: number): number => text.charCodeAt(index) | 0;

/**
 * Whether `secret` and `candidate` are the same string, examining as many positions as both
 * lengths add up to, regardless of where the first difference is. Different lengths are unequal
 * (the lengths are folded into the difference), but the loop still runs over every position.
 */
export function constantTimeEquals(secret: string, candidate: string): boolean {
  const positions = Array.from({ length: secret.length + candidate.length }, (_, i) => i);
  let difference = secret.length ^ candidate.length;
  for (const i of positions) difference |= codeAt(secret, i) ^ codeAt(candidate, i);
  return difference === 0;
}
