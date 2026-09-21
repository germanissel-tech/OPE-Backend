// What the outcomes controllers share at the boundary (ADR-028): DTO lines → domain lines.
import type { OrderItem } from "../../domain/outcomes/index.js";

export function linesOf(items: readonly { sku: string; quantity: number }[]): OrderItem[] {
  return items.map((i) => ({ sku: i.sku, quantity: i.quantity }));
}
