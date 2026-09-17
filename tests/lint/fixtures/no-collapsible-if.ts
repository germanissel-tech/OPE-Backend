// Lint fixture: violates only the rule in its name.
export function nested(a: boolean, b: boolean): number {
  if (a) {
    if (b) {
      return 1;
    }
  }
  return 0;
}
