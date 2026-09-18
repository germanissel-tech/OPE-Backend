// Lint fixture (as if under src/domain/<module>/): violates only ope/domain-no-loose-functions.
// A rule exported as a loose function instead of living with its concept.
export interface Basket {
  items: readonly string[];
}

export function isEmpty(basket: Basket): boolean {
  return basket.items.length === 0;
}

export const sizeOf = (basket: Basket): number => basket.items.length;
