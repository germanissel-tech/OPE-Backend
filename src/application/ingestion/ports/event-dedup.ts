// Puerto de deduplicación: reclama los eventIds de un lote para el merchant y devuelve los que
// entraron (los demás ya se habían visto). La ventana la declara la implementación.
import type { EventId, MerchantId } from "../../../domain/shared-kernel/index.js";

export interface EventDedup {
  claim(
    merchantId: MerchantId,
    eventIds: readonly EventId[],
  ): Promise<ReadonlySet<EventId>> | ReadonlySet<EventId>;
}
