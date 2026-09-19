// What controllers share at the boundary: DTO → Date (ADR-024: an unparsable date-time the
// contract admitted is a programming error), DTO lines → domain lines, and the idempotent
// answer of a notification (first receipt 201, repeat 200) with the same body.
import type { OrderItem } from "../../domain/outcomes/index.js";

export function instantOf(text: string): Date {
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new Error(`The contract admitted an unparsable date-time: ${text}`);
  return date;
}

export function linesOf(items: readonly { sku: string; quantity: number }[]): OrderItem[] {
  return items.map((i) => ({ sku: i.sku, quantity: i.quantity }));
}

const CREATED = 201;
const REPEATED = 200;

/** The two 2xx of an idempotent notification (ADR-020): created → 201, repeated → 200. */
export function idempotent<B>(
  outcome: "created" | "repeated",
  body: B,
): { status: typeof CREATED; body: B } | { status: typeof REPEATED; body: B } {
  return outcome === "created" ? { status: CREATED, body } : { status: REPEATED, body };
}
