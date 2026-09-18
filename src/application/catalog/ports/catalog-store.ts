// Catalogue store port (ADR-025): the current snapshot of a merchant and the instants OPE
// received the last few, which the observed synchronisation level is derived from.
import type { CatalogSnapshot } from "../../../domain/catalog/index.js";
import type { MerchantId } from "../../../domain/shared-kernel/index.js";

export interface CatalogStore {
  current(merchantId: MerchantId): Promise<CatalogSnapshot | undefined>;
  /** Replaces the current snapshot and records its `receivedAt` among the receipts. */
  replace(merchantId: MerchantId, snapshot: CatalogSnapshot): Promise<void>;
  /** The last receipts, oldest first; at most `RECEIPTS_KEPT`. */
  receipts(merchantId: MerchantId): Promise<readonly Date[]>;
}
