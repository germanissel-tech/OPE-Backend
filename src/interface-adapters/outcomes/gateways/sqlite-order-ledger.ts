// Order ledger on the durable store (ADR-028). Key merchant plus order.
//
// **First / repeat / conflict is decided inside one transaction**, which is what `01 §6` asks for:
// no asynchronous step between looking and writing. The port promised this before because the
// in-memory version ran in one synchronous section; here the store is what guarantees it, and the
// use case still never looks before writing.
//
// A return is the one write of this schema that is not an append: it is the RETURNED state of the
// chain (ADR-028), not an edit of what the platform sent.
import { Order, type OrderId, type OrderRecord } from "../../../domain/outcomes/index.js";
import { attempted, type DurableGatewayDeps } from "../../ledger/index.js";
import { fetched, fromDocument, toDocument } from "../../shared-kernel/index.js";
import type { OrderLedger, OrderRecording, ReturnRecording } from "../../../application/outcomes/index.js";
import type { MerchantId } from "../../../domain/shared-kernel/index.js";

const BY_ID = `SELECT document FROM orders WHERE merchant_id = :merchant AND order_id = :order`;

const INSERT = `INSERT INTO orders (merchant_id, order_id, document) VALUES (:merchant, :order, :document)`;

// `updated_at` is set here and not by a default: a DEFAULT only fires on an insert, and this is the
// one write of this schema that is not an append (ADR-028's RETURNED state).
const UPDATE = `UPDATE orders SET document = :document, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE merchant_id = :merchant AND order_id = :order`;

export function sqliteOrderLedger(deps: DurableGatewayDeps): OrderLedger {
  const existing = (merchantId: MerchantId, orderId: OrderId): Order | undefined => {
    const rows = deps.store.all(BY_ID, { merchant: merchantId, order: orderId });
    return rows.length === 0 ? undefined : orderOf(rows[0]?.["document"]);
  };

  return {
    record: (order) =>
      attempted(deps, "order", () =>
        deps.store.transaction((): OrderRecording => {
          const held = existing(order.merchantId, order.orderId);
          if (held === undefined) {
            deps.store.run(INSERT, {
              merchant: order.merchantId,
              order: order.orderId,
              document: toDocument(order.record()),
            });
            return { outcome: "recorded", order };
          }
          // What the platform sent decides identity; what OPE derived does not. The one held is
          // the one that answers, so a conflict does not quietly replace the first record.
          return { outcome: held.sameContentAs(order) ? "repeated" : "conflict", order: held };
        }),
      ),

    recordReturn: (merchantId, orderId, returned) =>
      attempted(deps, "return", () =>
        deps.store.transaction((): ReturnRecording => {
          const held = existing(merchantId, orderId);
          if (held === undefined) return { outcome: "unknown" };
          if (held.returned === undefined) {
            const order = held.withReturn(returned);
            deps.store.run(UPDATE, {
              merchant: merchantId,
              order: orderId,
              document: toDocument(order.record()),
            });
            return { outcome: "recorded", order };
          }
          return {
            outcome: held.returned.sameContentAs(returned) ? "repeated" : "conflict",
            order: held,
          };
        }),
      ),

    find: (merchantId, orderId) => fetched(deps, () => existing(merchantId, orderId)),
  };
}

/**
 * The document back as an order. The cast is true: `OrderRecord` declares its parts as the plain records
 * a document holds, and the order's constructor is what turns each one into its class (feature 037). The
 * document was written from an order this code had already judged, and `rehydrate` is defined not to
 * judge it again (ADR-024).
 */
const orderOf = (document: unknown): Order => Order.rehydrate(fromDocument(String(document)) as OrderRecord);
