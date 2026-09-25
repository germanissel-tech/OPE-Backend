// The role the catalogue depends on to report its own vocabulary (feature 027, FR-020): it hands
// over the attribute labels of the snapshot it just accepted and knows nothing about what is done
// with them — which keys OPE speaks about, which labels have a correspondence and what is kept is
// decided by whoever implements this, outside the catalogue.
//
// It reports and never asks: replacing the catalogue does not depend on the answer, so this returns
// nothing and cannot fail (FR-021). An implementation that throws breaks an ingestion that was
// already correct, and that is the one thing this must not do.
import type { Attribute } from "../../../domain/catalog/index.js";
import type { MerchantId } from "../../../domain/shared-kernel/index.js";

export interface AttributeLabelReportService {
  /**
   * @param attributes every attribute of every product, with repetitions: one entry per product.
   * @param at the instant the reported catalogue was received.
   */
  record(merchantId: MerchantId, attributes: readonly Attribute[], at: Date): Promise<void>;
}
