// Anchor diagnostics (01 §3.1.1, ADR-031): what the SDK reports when an anchor of the merchant's
// map stops resolving. Anchor and page type only; the last instant and a counter per key.
import type { Anchor, MerchantId } from "../shared-kernel/index.js";

export interface AnchorDiagnostic {
  merchantId: MerchantId;
  anchor: Anchor;
  pageType: string;
  /** The configuration version the SDK had loaded, when it said so. */
  configurationVersion?: number | undefined;
  lastSeenAt: Date;
  count: number;
}
