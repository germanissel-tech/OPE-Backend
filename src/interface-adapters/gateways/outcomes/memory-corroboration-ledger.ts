// In-memory corroboration ledger (ADR-028): one record per merchant, order and session; the
// first wins. Found by merchant and order, in the order recorded.
import { ok, type MerchantId, type SessionId } from "../../../domain/shared-kernel/index.js";
import type { CorroborationLedger } from "../../../application/outcomes/index.js";
import type { Corroboration, OrderId } from "../../../domain/outcomes/index.js";

export function memoryCorroborationLedger(): CorroborationLedger {
  const byOrder = new Map<string, Corroboration[]>();
  const key = (merchantId: MerchantId, orderId: OrderId): string => `${merchantId}/${orderId}`;
  const same = (a: Corroboration, sessionId: SessionId): boolean => a.sessionId === sessionId;
  return {
    record(corroboration) {
      const k = key(corroboration.merchantId, corroboration.orderId);
      const existing = byOrder.get(k) ?? [];
      if (existing.some((c) => same(c, corroboration.sessionId))) return Promise.resolve(ok("repeated"));
      byOrder.set(k, [...existing, corroboration]);
      return Promise.resolve(ok("recorded"));
    },
    find(merchantId, orderId) {
      return Promise.resolve(byOrder.get(key(merchantId, orderId)) ?? []);
    },
  };
}
