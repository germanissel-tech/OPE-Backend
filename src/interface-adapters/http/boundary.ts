// What controllers share at the boundary: DTO → Date (ADR-024: an unparsable date-time the
// contract admitted is a programming error), DTO lines → domain lines, and the idempotent
// answer of a notification (first receipt 201, repeat 200) with the same body.
import { HTTP_STATUS } from "./status.js";
import type { Page, PageQuery } from "../../application/shared-kernel/index.js";
import type { OrderItem } from "../../domain/outcomes/index.js";

export function instantOf(text: string): Date {
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) throw new Error(`The contract admitted an unparsable date-time: ${text}`);
  return date;
}

export function linesOf(items: readonly { sku: string; quantity: number }[]): OrderItem[] {
  return items.map((i) => ({ sku: i.sku, quantity: i.quantity }));
}

const CREATED = HTTP_STATUS.CREATED;
const REPEATED = HTTP_STATUS.OK;

/** The two 2xx of an idempotent notification (ADR-020): created → 201, repeated → 200. */
export function idempotent<B>(
  outcome: "created" | "repeated",
  body: B,
): { status: typeof CREATED; body: B } | { status: typeof REPEATED; body: B } {
  return outcome === "created" ? { status: CREATED, body } : { status: REPEATED, body };
}

/** The page size when the caller says nothing: the contract's default of `limit`. */
const DEFAULT_PAGE_LIMIT = 50;

/** The paging of a collection read (ADR-020) from the query the contract validated and coerced. */
export function pageQueryOf(
  query: { cursor?: string | undefined; limit?: number | undefined } | undefined,
): PageQuery {
  return {
    ...(query?.cursor === undefined ? {} : { cursor: query.cursor }),
    limit: query?.limit ?? DEFAULT_PAGE_LIMIT,
  };
}

/** A page as the contract publishes it: `nextCursor` only when there is a next page. */
export function pageDto<T, D>(page: Page<T>, item: (value: T) => D): { items: D[]; nextCursor?: string } {
  return {
    items: page.items.map(item),
    ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
  };
}
