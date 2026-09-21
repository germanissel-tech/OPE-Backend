// Admin log port (ADR-031): every administration action, accepted, rejected or denied. Writes
// return a Result: a log that cannot be written is a fact, not an exception (ADR-021).
import type { AdminEntry } from "../../../domain/admin/index.js";
import type { MerchantId, Result, StoreUnavailable } from "../../../domain/shared-kernel/index.js";
import type { Page, PageQuery } from "../../shared-kernel/index.js";

export interface AdminLog {
  record(entry: AdminEntry): Promise<Result<undefined, StoreUnavailable>>;
  /** Newest first. */
  list(query: PageQuery): Promise<Page<AdminEntry>>;
  listOf(merchantId: MerchantId, query: PageQuery): Promise<Page<AdminEntry>>;
}
