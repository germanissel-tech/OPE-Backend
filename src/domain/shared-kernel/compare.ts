// Comparison of a secret against a candidate without leaking how far they agree (ADR-029): the
// time spent does not depend on the first differing position. Pure TypeScript, so the domain
// can use it for signatures and platform keys without reaching for `node:crypto`.

const codeAt = (text: string, index: number): number => (index < text.length ? text.charCodeAt(index) : 0);

/**
 * Whether `secret` and `candidate` are the same string, examining every code unit of the
 * longer one regardless of where the first difference is. Different lengths are unequal, but
 * the loop still runs over the longer string.
 */
export function constantTimeEquals(secret: string, candidate: string): boolean {
  const length = Math.max(secret.length, candidate.length);
  let difference = secret.length ^ candidate.length;
  for (let i = 0; i < length; i += 1) {
    difference |= codeAt(secret, i) ^ codeAt(candidate, i);
  }
  return difference === 0;
}
