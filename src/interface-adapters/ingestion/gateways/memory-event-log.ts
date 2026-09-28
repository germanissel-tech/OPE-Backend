// The register in memory: what the `fast` project and the local deployment use.
//
// It exists so no unit test has to open a store, which is what keeps fast the loop the mutation gate
// needs (ADR-016) — and it runs the **same** contract of tests as the durable one, so the two cannot
// drift apart into whatever each felt natural.
//
// Unbounded, like the other in-memory ledgers of this ring: it is a test double and a local
// deployment, and a bound here would be a policy nobody asked for.
import type { EventLog, EventTypeCount, TimeWindow } from "../../../application/ingestion/index.js";
import type { EventId, EventType, RecordedEvent } from "../../../domain/ingestion/index.js";
import type { DecisionId } from "../../../domain/ledger/index.js";
import type { MerchantId, SessionId } from "../../../domain/shared-kernel/index.js";

/** `(merchant, batch, position)` as one string: the identity of an arrival, so the same one twice is one row. */
const arrivalKey = (arrival: RecordedEvent): string =>
  `${arrival.merchantId}\u001f${arrival.batchId}\u001f${String(arrival.position)}`;

const within = (at: Date, window: TimeWindow): boolean =>
  at.getTime() >= window.from.getTime() && at.getTime() <= window.to.getTime();

export function memoryEventLog(): EventLog {
  // Insertion order is the arrival order, which is what `bySession` and `byEvent` promise. An array
  // gives it for free; the set beside it is what makes a repeated arrival a repetition.
  const rows: RecordedEvent[] = [];
  const arrivals = new Set<string>();

  const of = (merchantId: MerchantId, keep: (row: RecordedEvent) => boolean): Promise<RecordedEvent[]> =>
    Promise.resolve(rows.filter((row) => row.merchantId === merchantId && keep(row)));

  return {
    record(batch) {
      for (const arrival of batch) {
        const key = arrivalKey(arrival);
        if (arrivals.has(key)) continue;
        arrivals.add(key);
        rows.push(arrival);
      }
    },
    byDecision: (merchantId: MerchantId, decisionId: DecisionId) =>
      of(merchantId, (row) => row.disposition !== "rejected" && row.decisionId === decisionId),
    bySession: (merchantId: MerchantId, sessionId: SessionId) =>
      of(merchantId, (row) => row.event.sessionId === sessionId),
    byEvent: (merchantId: MerchantId, eventId: EventId) =>
      of(merchantId, (row) => row.event.eventId === eventId),
    volume(merchantId: MerchantId, window: TimeWindow): Promise<EventTypeCount[]> {
      const counted = new Map<EventType, number>();
      for (const row of rows) {
        if (row.merchantId !== merchantId || !within(row.receivedAt, window)) continue;
        counted.set(row.event.type, (counted.get(row.event.type) ?? 0) + 1);
      }
      return Promise.resolve([...counted].map(([type, count]) => ({ type, count })));
    },
  };
}
