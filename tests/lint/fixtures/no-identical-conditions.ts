// Lint fixture: violates only the rule in its name.
export function chain(a: boolean, b: boolean): number {
  if (a) {
    return 1;
  } else if (a) {
    return 2;
  }
  return b ? 3 : 4;
}
