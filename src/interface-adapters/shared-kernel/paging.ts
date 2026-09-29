// Paging of the gateways (ADR-020): an opaque cursor, a limit the caller asks for and a cap the
// gateway imposes. Two forms, because the two kinds of gateway can answer honestly in different
// ways: in memory the cursor is a **position** in the list, and on a store it is the **key** of the
// last row served.
import type { Page, PageQuery } from "../../application/shared-kernel/index.js";

/** The most entries one page carries, whatever the caller asked. */
const MAX_PAGE = 200;

/** The size of the page, which is what the caller asked for unless it is outside what is served. */
const sizeOf = (query: PageQuery): number => Math.min(Math.max(query.limit, 1), MAX_PAGE);

/** A page of `items` (already newest first) from the position the cursor names. */
export function pageOf<T>(items: readonly T[], query: PageQuery): Page<T> {
  // An absent or malformed cursor is NaN and reads as the first page.
  const start = Number(query.cursor);
  const from = Number.isInteger(start) ? Math.max(start, 0) : 0;
  const size = sizeOf(query);
  const slice = items.slice(from, from + size);
  const next = from + size;
  return next < items.length ? { items: slice, nextCursor: String(next) } : { items: slice };
}

/**
 * What a durable read asks the store for.
 *
 * **The cursor is a key and not a position, and that is the difference that matters**: these tables
 * are append-only, so a position counted from the newest row names a different row as soon as
 * anything is appended — the second page would repeat what the first already served. A key does not
 * move.
 */
export interface Descending {
  /** Only rows whose key is **below** this one; the first page starts above every key there can be. */
  readonly below: number;
  /** What the statement binds as its limit: one more than the page carries, for the reason in `pageTo`. */
  readonly limit: number;
  /** How many rows the page carries at most. */
  readonly size: number;
}

/** The descending window a query names, with the cap applied. */
export function descending(query: PageQuery): Descending {
  const from = Number(query.cursor);
  const size = sizeOf(query);
  // An absent or malformed cursor reads as the first page, which is every row: the keys of these
  // tables are positive, so no row can sit above this.
  const below = Number.isInteger(from) && from > 0 ? from : Number.MAX_SAFE_INTEGER;
  return { below, limit: size + 1, size };
}

/**
 * The rows the store answered as a page. The statement asked for **one row more** than the page
 * carries, and that extra row is never served: it is the only thing that says whether there is a
 * next page. Without it the gateway would have to either count the whole table or answer a cursor
 * that leads to an empty page.
 */
export function pageTo<T>(rows: readonly { key: number; item: T }[], window: Descending): Page<T> {
  const served = rows.slice(0, window.size);
  const items = served.map((row) => row.item);
  const last = served.at(-1);
  if (rows.length <= window.size || last === undefined) return { items };
  return { items, nextCursor: String(last.key) };
}
