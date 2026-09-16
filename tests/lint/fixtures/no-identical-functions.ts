// Lint fixture: violates only the rule in its name.
export function first(xs: number[]): number {
  const [head] = xs;
  if (head === undefined) return 0;
  return head * 2;
}

export function second(xs: number[]): number {
  const [head] = xs;
  if (head === undefined) return 0;
  return head * 2;
}
