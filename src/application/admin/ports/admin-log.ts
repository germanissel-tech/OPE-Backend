// Admin log port (ADR-031, ADR-034): the audit trail of the platform, plus the two reads that
// belong to the administration. The write is the kernel's port —any module may have to audit—
// and the entry is stored with its actor typed again by whoever implements it.
import type { AdminEntry } from "../../../domain/admin/index.js";
import type { MerchantId } from "../../../domain/shared-kernel/index.js";
import type { AuditTrail, Page, PageQuery } from "../../shared-kernel/index.js";

export interface AdminLog extends AuditTrail {
  /** Newest first. */
  list(query: PageQuery): Promise<Page<AdminEntry>>;
  listOf(merchantId: MerchantId, query: PageQuery): Promise<Page<AdminEntry>>;
}
