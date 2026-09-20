// In-memory admin log (ADR-031): append-only, newest first when read. The cursor is the
// position in the list as an opaque string; a limit above the cap is capped.
import { ok, type MerchantId } from "../../../domain/shared-kernel/index.js";
import type { AdminLog } from "../../../application/admin/index.js";
import type { Page, PageQuery } from "../../../application/shared-kernel/index.js";
import type { AdminEntry } from "../../../domain/admin/index.js";

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

export function memoryAdminLog(): AdminLog {
  const entries: AdminEntry[] = [];
  const newestFirst = (of?: MerchantId): AdminEntry[] =>
    entries.filter((e) => of === undefined || e.merchantId === of).reverse();
  return {
    record(entry) {
      entries.push(entry);
      return Promise.resolve(ok(undefined));
    },
    list(query) {
      return Promise.resolve(pageOf(newestFirst(), query));
    },
    listOf(merchantId, query) {
      return Promise.resolve(pageOf(newestFirst(merchantId), query));
    },
  };
}
