// Corroboration ledger on the durable store (ADR-028): one record per merchant, order and
// session, and the first one wins. That rule is the primary key, so the store decides it and not
// a read the caller does first.
//
// Found by merchant and order, in the order recorded — the table's own `id`, monotonic per insert.
// It used to be SQLite's implicit `rowid`, which PostgreSQL does not have (D-21); migration 002 gave
// every table an autoincrementing key, so the order no longer depends on the engine.
import { Corroboration, type CorroborationRecord } from "../../../domain/outcomes/index.js";
import { attempted, type DurableGatewayDeps } from "../../ledger/index.js";
import { fromDocument, toDocument } from "../../shared-kernel/index.js";
import type { CorroborationLedger } from "../../../application/outcomes/index.js";

const INSERT = `INSERT INTO corroborations (merchant_id, order_id, session_id, document)
  VALUES (:merchant, :order, :session, :document)
  ON CONFLICT (merchant_id, order_id, session_id) DO NOTHING`;

const CHANGED = `SELECT changes() AS changed`;

const BY_ORDER = `SELECT document FROM corroborations
  WHERE merchant_id = :merchant AND order_id = :order ORDER BY id`;

export function sqliteCorroborationLedger(deps: DurableGatewayDeps): CorroborationLedger {
  return {
    record: (corroboration) =>
      attempted(deps, "corroboration", () =>
        // One transaction, so `changes()` reports this insert: it is per connection, and a write
        // that slipped in between would make a first corroboration look like a repeat.
        deps.store.transaction(() => {
          deps.store.run(INSERT, {
            merchant: corroboration.merchantId,
            order: corroboration.orderId,
            session: corroboration.sessionId,
            document: toDocument(corroboration.record()),
          });
          return deps.store.all(CHANGED)[0]?.["changed"] === 1 ? "recorded" : "repeated";
        }),
      ),
    find: (merchantId, orderId) =>
      Promise.resolve(
        deps.store
          .all(BY_ORDER, { merchant: merchantId, order: orderId })
          .map((row) =>
            Corroboration.rehydrate(fromDocument(String(row["document"])) as CorroborationRecord),
          ),
      ),
  };
}
