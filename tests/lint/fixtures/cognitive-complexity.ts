// Lint fixture: violates only the rule in its name.
export function score(a: number, b: number, c: number): number {
  let total = 0;
  if (a > 0) {
    for (let i = 0; i < a; i++) {
      if (i % 2 === 0) {
        total += i;
      } else if (i % 3 === 0) {
        total -= i;
      } else {
        total += 1;
      }
    }
  }
  if (b > 0) {
    while (total < b) {
      if (total % 2 === 0 && c > 0) {
        total += c;
      } else if (total % 5 === 0 || c < 0) {
        total -= 1;
      } else {
        total += 2;
      }
    }
  }
  return total;
}
