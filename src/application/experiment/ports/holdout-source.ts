// Holdout port (feature 017; constitution XI): what the merchant keeps out of OPE, as its
// effective configuration resolves it. The configuration module serves it; the composition binds it.
import type { MerchantId } from "../../../domain/shared-kernel/index.js";

export interface HoldoutSource {
  /** The holdout of the merchant as a rate 0..1. */
  holdoutShareFor(merchantId: MerchantId): Promise<number>;
}
