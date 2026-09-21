// Paging of the in-memory gateways (ADR-020): an opaque cursor that is the position in the
// list, a limit the caller asks for and a cap the gateway imposes.
import type { Page, PageQuery } from "../../application/shared-kernel/index.js";

/** The most entries one page carries, whatever the caller asked. */
const MAX_PAGE = 200;

/** A page of `items` (already newest first) from the position the cursor names. */
export function pageOf<T>(items: readonly T[], query: PageQuery): Page<T> {
  // An absent or malformed cursor is NaN and reads as the first page.
  const start = Number(query.cursor);
  const from = Number.isInteger(start) ? Math.max(start, 0) : 0;
  const size = Math.min(Math.max(query.limit, 1), MAX_PAGE);
  const slice = items.slice(from, from + size);
  const next = from + size;
  return next < items.length ? { items: slice, nextCursor: String(next) } : { items: slice };
}
