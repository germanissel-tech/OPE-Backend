// Deduplication port: claims the eventIds of a batch for the merchant and returns those that
// entered for the first time (the rest are duplicates within the window the platform declares,
// level 1 of the configuration; published in the description of ingestEvents).
import type { EventId } from "../../../domain/ingestion/index.js";
import type { MerchantId } from "../../../domain/shared-kernel/index.js";

export interface DedupWindow {
  /** Ids older than this are forgotten. */
  ttlMs: number;
  /** Ids kept per merchant at most; the oldest go first. */
  maxIds: number;
}

export interface EventDedup {
  claim(merchantId: MerchantId, eventIds: readonly EventId[]): Promise<ReadonlySet<EventId>>;
}
