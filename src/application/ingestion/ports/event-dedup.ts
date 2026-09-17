// Deduplication port: claims the eventIds of a batch for the merchant and returns those that
// came in (the rest had already been seen). The window is declared by the implementation.
import type { EventId, MerchantId } from "../../../domain/shared-kernel/index.js";

export interface EventDedup {
  claim(
    merchantId: MerchantId,
    eventIds: readonly EventId[],
  ): Promise<ReadonlySet<EventId>> | ReadonlySet<EventId>;
}
