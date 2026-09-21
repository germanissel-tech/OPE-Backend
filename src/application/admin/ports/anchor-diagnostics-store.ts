// Anchor diagnostics store port (01 §3.1.1, ADR-031): the last report per anchor, page type and
// configuration version of a merchant, with a counter; bounded by the platform configuration.
import type { AnchorDiagnostic } from "../../../domain/admin/index.js";
import type { MerchantId, Result, StoreUnavailable } from "../../../domain/shared-kernel/index.js";
import type { Page, PageQuery } from "../../shared-kernel/index.js";

export interface AnchorDiagnosticsStore {
  /** Records one unresolved anchor: the same key updates the instant and increments the counter. */
  upsert(diagnostic: Omit<AnchorDiagnostic, "count">): Promise<Result<undefined, StoreUnavailable>>;
  /** Most recent first. */
  listOf(merchantId: MerchantId, query: PageQuery): Promise<Page<AnchorDiagnostic>>;
}
