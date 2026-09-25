// What the catalogue of a merchant brought that OPE has no word for (01 §3.1.1, feature 027): a
// label of its own that its correspondence does not translate to any value of the vocabulary. It
// lives here and not in `messages` for the same reason as the anchor diagnostic: what it is for is
// an operator reading a report, and the vocabulary itself neither knows nor needs one.
import type { MerchantId } from "../shared-kernel/index.js";

export interface UnmappedAttributeValue {
  merchantId: MerchantId;
  /** The label as the platform of the merchant exposes it; never normalised, never published as text. */
  label: string;
  /** Products of the last catalogue that carry it: how much of the shop stops speaking. */
  products: number;
  /** The first catalogue it arrived in without a correspondence. */
  firstSeenAt: Date;
  /** The last catalogue it arrived in. */
  lastSeenAt: Date;
}
