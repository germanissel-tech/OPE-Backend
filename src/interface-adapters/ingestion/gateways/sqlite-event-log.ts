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
import { fetched, fromDocument, toDocument, type SqlParams, type SqlRow } from "../../shared-kernel/index.js";
import type { EventLog, EventTypeCount, Hole, TimeWindow } from "../../../application/ingestion/index.js";
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

/**
 * The ids of a merchant since an instant, most recent first and capped: what rebuilds the deduplication
 * window (feature 033). **It needed no index of its own** — `received_events_volume` is
 * `(merchant_id, received_at, type)` and this uses its `(merchant_id, received_at)` prefix, which is
 * exactly the range asked for. `event_id` is not in that index, so the rows are visited; the `LIMIT` is
 * what bounds how many, and it is the window's own cap rather than a number chosen here.
 */
const IDS_SINCE = `SELECT event_id FROM received_events
  WHERE merchant_id = :merchant AND received_at >= :since
  ORDER BY received_at DESC, id DESC LIMIT :limit`;

/** The one query the covering index exists for: equality, then the range, then what is grouped. */
const VOLUME = `SELECT type, COUNT(*) AS count FROM received_events
  WHERE merchant_id = :merchant AND received_at >= :from AND received_at <= :to
  GROUP BY type`;

/**
 * What arrived and was never written (FR-018). A decision that **declares how many events its batch
 * carried** and has no events in the register is a batch that arrived and was lost — because the
 * decision's write is synchronous and the register's is queued.
 *
 * Three things about this query are the answer and not incidental:
 *
 * - `eventsInBatch IS NOT NULL` is what keeps decisions **recorded before feature 031** out of the
 *   count. They have no events in the register and never will, and that is expected rather than a
 *   hole; the field is optional for exactly this reason (see `DecisionFacts`).
 * - The counted events come from the ledger, which is why the number is in events and not only in
 *   batches: the rows that would say how many are the ones that are missing.
 * - It reads the two tables because the comparison **is** the question. Going through the ledger's
 *   port instead would mean adding a read that exists only for this and that would read the same two
 *   tables from one table further away.
 *
 * **Its cost is a full pass over the decisions**, once, at start-up. That is declared rather than
 * optimised away: the bound would be "decisions after the last recorded event", and `decidedAt` lives
 * inside the document where no index reaches it. When a start-up spends noticeable time here, the fix
 * is an instant column on `decisions`, and the number is what should ask for it.
 */
const UNRECORDED = `SELECT
    COUNT(*) AS batches,
    SUM(json_extract(d.document, '$.eventsInBatch')) AS events,
    MIN(json_extract(d.document, '$.decidedAt."$date"')) AS first,
    MAX(json_extract(d.document, '$.decidedAt."$date"')) AS last
  FROM decisions d
  WHERE json_extract(d.document, '$.eventsInBatch') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM received_events r
      WHERE r.merchant_id = d.merchant_id AND r.decision_id = d.decision_id
    )`;

const DOCUMENT = "document";
const EVENT_ID = "event_id";
const TYPE = "type";
const COUNT = "count";
const BATCHES = "batches";
const EVENTS = "events";
const FIRST = "first";
const LAST = "last";

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
    fetched(deps, () => deps.store.all(sql, params).map((row: SqlRow) => arrivalOf(row[DOCUMENT])));

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
    unrecorded: (): Promise<Hole | undefined> =>
      fetched(deps, () => {
        const [row] = deps.store.all(UNRECORDED, {});
        const batches = Number(row?.[BATCHES] ?? 0);
        // Nothing missing is the ordinary answer, and the aggregate says so with zero batches — the other
        // three columns are then null, which is why the count is what decides and not they.
        if (batches === 0) return undefined;
        return {
          batches,
          events: Number(row?.[EVENTS] ?? 0),
          from: new Date(String(row?.[FIRST])),
          to: new Date(String(row?.[LAST])),
        };
      }),
    idsSince: (merchantId: MerchantId, since: Date, limit: number): Promise<EventId[]> =>
      fetched(deps, () =>
        deps.store
          .all(IDS_SINCE, { merchant: merchantId, since: since.toISOString(), limit })
          .map((row) => String(row[EVENT_ID]) as EventId),
      ),
    volume: (merchantId: MerchantId, window: TimeWindow): Promise<EventTypeCount[]> =>
      fetched(deps, () =>
        deps.store
          .all(VOLUME, {
            merchant: merchantId,
            from: window.from.toISOString(),
            to: window.to.toISOString(),
          })
          .map((row) => ({ type: row[TYPE] as EventType, count: Number(row[COUNT]) })),
      ),
  };
}
