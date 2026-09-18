// Deduplication port: claims the eventIds of a batch for the merchant and returns those that
// entered for the first time (the rest are duplicates within the window the policy declares).
import type { EventId, MerchantId } from "../../../domain/shared-kernel/index.js";

export interface EventDedup {
  claim(merchantId: MerchantId, eventIds: readonly EventId[]): Promise<ReadonlySet<EventId>>;
}
