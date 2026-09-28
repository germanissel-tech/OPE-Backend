// The register on the durable store (feature 031). It follows the pattern of every durable gateway —
// the driver arrives through its binding, the document is written whole, and nothing is deferred to a
// later tick — with **one deliberate difference**, which is the whole point of this port.
//
// **The write has no failure channel, so a failure is logged and nothing else.** Every other durable
// gateway answers `LedgerUnavailable` because the decision plane needs it to fail closed (ADR-021).
// Here there is nowhere to report to and nowhere it should be reported: degrading a decision because a
// **measurement** could not be written is exactly the mixing `01 §P9` exists to prevent. So the one
// line written here is the whole story of a failed write, and what was lost is counted at start-up by
// reconciling the ledger against this table (FR-018).
//
// `INSERT OR IGNORE` and not a read first: `(merchant, batch, position)` is the identity of an
// arrival, so the store decides whether one is a repetition — which is what happens when a queue hands
// the same arrival over twice.
import { fromDocument, toDocument, type SqlParams, type SqlRow } from "../../shared-kernel/index.js";
import type { EventLog, EventTypeCount, TimeWindow } from "../../../application/ingestion/index.js";
import type { EventId, EventType, RecordedEvent } from "../../../domain/ingestion/index.js";
import type { DecisionId } from "../../../domain/ledger/index.js";
import type { MerchantId, SessionId } from "../../../domain/shared-kernel/index.js";
import type { DurableGatewayDeps } from "../../ledger/index.js";

const INSERT = `INSERT OR IGNORE INTO received_events
  (merchant_id, batch_id, position, event_id, session_id, type, received_at, disposition, decision_id, document)
  VALUES (:merchant, :batch, :position, :event, :session, :type, :receivedAt, :disposition, :decision, :document)`;

/** `ORDER BY id` is the arrival order, and it is a column of the schema rather than SQLite's `rowid` (D-21). */
const ORDERED = "ORDER BY id";

const BY_DECISION = `SELECT document FROM received_events
  WHERE merchant_id = :merchant AND decision_id = :decision ${ORDERED}`;

const BY_SESSION = `SELECT document FROM received_events
  WHERE merchant_id = :merchant AND session_id = :session ${ORDERED}`;

const BY_EVENT = `SELECT document FROM received_events
  WHERE merchant_id = :merchant AND event_id = :event ${ORDERED}`;

/** The one query the covering index exists for: equality, then the range, then what is grouped. */
const VOLUME = `SELECT type, COUNT(*) AS count FROM received_events
  WHERE merchant_id = :merchant AND received_at >= :from AND received_at <= :to
  GROUP BY type`;

const DOCUMENT = "document";
const TYPE = "type";
const COUNT = "count";

/** The document holds the whole arrival, so a new field of the domain travels without this file knowing. */
const arrivalOf = (document: unknown): RecordedEvent =>
  fromDocument(typeof document === "string" ? document : "") as RecordedEvent;

function paramsOf(arrival: RecordedEvent): SqlParams {
  return {
    merchant: arrival.merchantId,
    batch: arrival.batchId,
    position: arrival.position,
    event: arrival.event.eventId,
    session: arrival.event.sessionId,
    type: arrival.event.type,
    receivedAt: arrival.receivedAt.toISOString(),
    disposition: arrival.disposition,
    // The column is nullable for exactly one case: a rejected batch produced no decision.
    decision: arrival.disposition === "rejected" ? null : arrival.decisionId,
    document: toDocument(arrival),
  };
}

export function sqliteEventLog(deps: DurableGatewayDeps): EventLog {
  const read = (sql: string, params: SqlParams): Promise<RecordedEvent[]> =>
    Promise.resolve(deps.store.all(sql, params).map((row: SqlRow) => arrivalOf(row[DOCUMENT])));

  return {
    record(arrivals) {
      try {
        // One transaction for the batch: a queue flush is one unit of work, and half of it written is
        // a hole that looks like two different arrivals.
        deps.store.transaction(() => {
          for (const arrival of arrivals) deps.store.run(INSERT, paramsOf(arrival));
        });
      } catch (failure) {
        deps.logger.error(
          {
            arrivals: arrivals.length,
            cause: failure instanceof Error ? failure.message : String(failure),
          },
          "The durable store refused a write of the event register; those arrivals are lost.",
        );
      }
    },
    byDecision: (merchantId: MerchantId, decisionId: DecisionId) =>
      read(BY_DECISION, { merchant: merchantId, decision: decisionId }),
    bySession: (merchantId: MerchantId, sessionId: SessionId) =>
      read(BY_SESSION, { merchant: merchantId, session: sessionId }),
    byEvent: (merchantId: MerchantId, eventId: EventId) =>
      read(BY_EVENT, { merchant: merchantId, event: eventId }),
    volume(merchantId: MerchantId, window: TimeWindow): Promise<EventTypeCount[]> {
      const rows = deps.store.all(VOLUME, {
        merchant: merchantId,
        from: window.from.toISOString(),
        to: window.to.toISOString(),
      });
      return Promise.resolve(
        rows.map((row) => ({ type: row[TYPE] as EventType, count: Number(row[COUNT]) })),
      );
    },
  };
}
