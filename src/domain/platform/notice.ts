// A notice of the merchant's platform (feature 044, ADR-047; research R-06): that an order or a return changed,
// and which. It enters nothing by itself — what is recorded comes from reading the reference — so it carries
// only what the read needs and what the retry counts. A value without rules of its own: when it is read again
// is the rule of `NoticeRetry` (ADR-024).
import type { MerchantId, NoticedFlow } from "../shared-kernel/index.js";

export interface Notice {
  merchantId: MerchantId;
  flow: NoticedFlow;
  /** The order the notice is about, as the platform names it. */
  reference: string;
  /** What the platform said the state was; only kept with the notice, never recorded as the order's. */
  state?: string | undefined;
  receivedAt: Date;
  /** Reads that failed so far. */
  attempts: number;
  /** When the next read is due. */
  nextAt: Date;
  /**
   * `pull` when it is a return a run of `pull` read before its order was recorded, and that waits here to be read
   * again (feature 045); absent, a notice of `subscribe`. It decides the gate the read deposits through.
   */
  via?: "pull" | undefined;
}
