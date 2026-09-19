// Order ledger port (ADR-028): the VERIFIED_ORDER / ATTRIBUTED_ORDER / PENDING_CORRELATION /
// RETURNED states. The port decides first / repeat / conflict itself, atomically (01 §6: no
// asynchronous step between the existence check and the write); the use case never looks
// before writing. `record` and `recordReturn` follow ADR-021: accepted, or LedgerUnavailable.
import type { LedgerUnavailable } from "../../../domain/ledger/index.js";
import type { Order, OrderId, Return } from "../../../domain/outcomes/index.js";
import type { MerchantId, Result } from "../../../domain/shared-kernel/index.js";

/** What happened to the write; `order` is the recorded one (the existing one on repeat or conflict). */
export interface OrderRecording {
  outcome: "recorded" | "repeated" | "conflict";
  order: Order;
}

export type ReturnRecording = OrderRecording | { outcome: "unknown" };

export interface OrderLedger {
  record(order: Order): Promise<Result<OrderRecording, LedgerUnavailable>>;
  /** Marks the order returned; `unknown` when no such order exists for the merchant. */
  recordReturn(
    merchantId: MerchantId,
    orderId: OrderId,
    returned: Return,
  ): Promise<Result<ReturnRecording, LedgerUnavailable>>;
  find(merchantId: MerchantId, orderId: OrderId): Promise<Order | undefined>;
}
