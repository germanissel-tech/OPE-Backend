// Eval fixture: the same knowledge (a margin rate to a percentage) written twice.
export function marginPercent(rate: number): number {
  if (rate < 0) return 0;
  if (rate > 1) return 100;
  return Math.round(rate * 100);
}

export function discountPercent(rate: number): number {
  if (rate < 0) return 0;
  if (rate > 1) return 100;
  return Math.round(rate * 100);
}
