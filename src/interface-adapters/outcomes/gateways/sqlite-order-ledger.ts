// Order ledger on the durable store (ADR-028). Key merchant plus order.
//
// **First / repeat / conflict is decided inside one transaction**, which is what `01 §6` asks for:
// no asynchronous step between looking and writing. The port promised this before because the
// in-memory version ran in one synchronous section; here the store is what guarantees it, and the
// use case still never looks before writing.
//
// A return is the one write of this schema that is not an append: it is the RETURNED state of the
// chain (ADR-028), not an edit of what the platform sent.
import {
  Correlation,
  IncentiveRedemption,
  Order,
  Return,
  type OrderId,
  type OrderRecord,
} from "../../../domain/outcomes/index.js";
import { Money, type MerchantId } from "../../../domain/shared-kernel/index.js";
import { attempted, type DurableGatewayDeps } from "../../ledger/index.js";
import { fromDocument, toDocument } from "../../shared-kernel/index.js";
import type { OrderLedger, OrderRecording, ReturnRecording } from "../../../application/outcomes/index.js";

const BY_ID = `SELECT document FROM orders WHERE merchant_id = :merchant AND order_id = :order`;

const INSERT = `INSERT INTO orders (merchant_id, order_id, document) VALUES (:merchant, :order, :document)`;

const UPDATE = `UPDATE orders SET document = :document WHERE merchant_id = :merchant AND order_id = :order`;

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

    find: (merchantId, orderId) => Promise.resolve(existing(merchantId, orderId)),
  };
}

/**
 * The document back as an order. **Every part of it that is a class is rehydrated, not left as
 * the plain object `JSON.parse` produced**: an order whose `total` is a bare `{amount, currency}`
 * has no `equals`, and one whose `returned` has no `sameContentAs` throws when a return is
 * repeated — the sort of thing that looks fine in every read and fails on the one write that
 * matters. The four here are the four the order carries today; a fifth would fail `typecheck`,
 * which is why they are named rather than walked.
 *
 * The cast is where the reasoning leaves the compiler: the document was written from an order
 * this code had already judged, and `rehydrate` is defined not to judge it again (ADR-024).
 */
function orderOf(document: unknown): Order {
  const record = fromDocument(String(document)) as OrderRecord;
  return Order.rehydrate({
    ...record,
    total: Money.rehydrate(record.total),
    correlation: record.correlation === undefined ? undefined : Correlation.rehydrate(record.correlation),
    redemption:
      record.redemption === undefined ? undefined : IncentiveRedemption.rehydrate(record.redemption),
    returned: record.returned === undefined ? undefined : Return.rehydrate(record.returned),
  });
}
