// Lint fixture: violates only the rule in its name.
export function redundant(a: boolean): boolean {
  return a && true;
}
