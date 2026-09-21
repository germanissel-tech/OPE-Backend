// In-memory order ledger (ADR-028). Composite key merchant + order: an order of another
// merchant does not exist for whoever asks. First / repeat / conflict is decided in one
// synchronous section: two simultaneous notifications of the same order produce one record.
import { ok, type MerchantId } from "../../../domain/shared-kernel/index.js";
import type { OrderLedger } from "../../../application/outcomes/index.js";
import type { Order, OrderId } from "../../../domain/outcomes/index.js";

export function memoryOrderLedger(): OrderLedger {
  const orders = new Map<string, Order>();
  const key = (merchantId: MerchantId, orderId: OrderId): string => `${merchantId}/${orderId}`;
  return {
    record(order) {
      const k = key(order.merchantId, order.orderId);
      const existing = orders.get(k);
      if (existing === undefined) {
        orders.set(k, order);
        return Promise.resolve(ok({ outcome: "recorded", order }));
      }
      const outcome = existing.sameContentAs(order) ? "repeated" : "conflict";
      return Promise.resolve(ok({ outcome, order: existing }));
    },
    recordReturn(merchantId, orderId, returned) {
      const k = key(merchantId, orderId);
      const existing = orders.get(k);
      if (existing === undefined) return Promise.resolve(ok({ outcome: "unknown" }));
      if (existing.returned === undefined) {
        const order = existing.withReturn(returned);
        orders.set(k, order);
        return Promise.resolve(ok({ outcome: "recorded", order }));
      }
      const outcome = existing.returned.sameContentAs(returned) ? "repeated" : "conflict";
      return Promise.resolve(ok({ outcome, order: existing }));
    },
    find(merchantId, orderId) {
      return Promise.resolve(orders.get(key(merchantId, orderId)));
    },
  };
}
