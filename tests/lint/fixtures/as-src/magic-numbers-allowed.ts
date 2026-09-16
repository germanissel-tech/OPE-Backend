// Lint fixture (as if under src/): 0, 1, -1 and array indexes are allowed.
export function allowed(xs: number[]): number {
  const first = xs[0] ?? -1;
  return first === 1 ? 0 : first;
}
