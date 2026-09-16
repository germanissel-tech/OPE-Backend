// Lint fixture: violates only the rule in its name.
export function same(a: boolean): number {
  if (a) {
    return 1;
  } else {
    return 1;
  }
}
