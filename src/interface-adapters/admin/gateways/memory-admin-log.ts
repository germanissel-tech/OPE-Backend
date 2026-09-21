// In-memory admin log (ADR-031): append-only, newest first when read. The cursor is the
// position in the list as an opaque string; a limit above the cap is capped.
import { ok, type MerchantId } from "../../../domain/shared-kernel/index.js";
import { pageOf } from "../../shared-kernel/index.js";
import type { AdminLog } from "../../../application/admin/index.js";
import type { AdminEntry } from "../../../domain/admin/index.js";

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
