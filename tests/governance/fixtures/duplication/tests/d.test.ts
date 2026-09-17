// Duplication fixture: c.test.ts repeats the block: informative only.
export function scoreD(xs: number[]): number {
  let total = 0;
  for (const x of xs) {
    if (x > 10) {
      total += x * 2;
    } else if (x < 0) {
      total -= x;
    } else {
      total += x;
    }
  }
  return total;
}
