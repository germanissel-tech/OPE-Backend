// Catalogue store port (ADR-025, ADR-047): the current snapshot of a merchant, the refreshes of stock and price
// layered over it, and the instants OPE received the last few of either, which the observed synchronisation
// level is derived from. Every write follows ADR-021: accepted, or LedgerUnavailable; never throws.
import type {
  CatalogSnapshot,
  RefreshOutcomes,
  StockAndPrice,
  StockAndPriceRefresh,
  VariantId,
} from "../../../domain/catalog/index.js";
import type { LedgerUnavailable } from "../../../domain/ledger/index.js";
import type { MerchantId, Result } from "../../../domain/shared-kernel/index.js";

export type CatalogReplaceResult = Result<void, LedgerUnavailable>;
export type CatalogRefreshResult = Result<RefreshOutcomes, LedgerUnavailable>;

export interface CatalogStore {
  current(merchantId: MerchantId): Promise<CatalogSnapshot | undefined>;
  /**
   * Replaces the current snapshot, forgets the refreshes it supersedes (observed at its capture or before) and
   * records its `receivedAt` among the last `receiptsKept`; or says it cannot.
   */
  replace(
    merchantId: MerchantId,
    snapshot: CatalogSnapshot,
    receiptsKept: number,
  ): Promise<CatalogReplaceResult>;
  /** The refresh kept for a variant, if any. */
  refreshOf(merchantId: MerchantId, variantId: VariantId): Promise<StockAndPrice | undefined>;
  /**
   * Judges the refresh against the snapshot and the refreshes kept and keeps what it applied, **in one step**:
   * deciding applied or repeated and writing it cannot leave a gap another refresh walks into (01 §6). With a
   * snapshot in force it also records the refresh's `receivedAt` among the last `receiptsKept` (research R-05).
   */
  refresh(refresh: StockAndPriceRefresh, receiptsKept: number): Promise<CatalogRefreshResult>;
  /** The last receipts, oldest first. */
  receipts(merchantId: MerchantId): Promise<readonly Date[]>;
}
