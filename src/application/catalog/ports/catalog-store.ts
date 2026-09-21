// Catalogue store port (ADR-025): the current snapshot of a merchant and the instants OPE
// received the last few, which the observed synchronisation level is derived from. `replace`
// follows ADR-021 like every write: accepted, or LedgerUnavailable; never throws.
import type { CatalogSnapshot } from "../../../domain/catalog/index.js";
import type { LedgerUnavailable } from "../../../domain/ledger/index.js";
import type { MerchantId, Result } from "../../../domain/shared-kernel/index.js";

export type CatalogReplaceResult = Result<void, LedgerUnavailable>;

export interface CatalogStore {
  current(merchantId: MerchantId): Promise<CatalogSnapshot | undefined>;
  /** Replaces the current snapshot and records its `receivedAt` among the last `receiptsKept`, or says it cannot. */
  replace(
    merchantId: MerchantId,
    snapshot: CatalogSnapshot,
    receiptsKept: number,
  ): Promise<CatalogReplaceResult>;
  /** The last receipts, oldest first. */
  receipts(merchantId: MerchantId): Promise<readonly Date[]>;
}
