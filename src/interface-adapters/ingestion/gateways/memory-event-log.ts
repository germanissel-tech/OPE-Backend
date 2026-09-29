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
    /**
     * Nothing, always, and that is the truth here rather than a stub: a restart of a deployment with
     * everything in memory loses the register **and** the decisions ledger, so there is no surviving
     * side to compare the other against. A hole needs one half to outlive the process.
     */
    unrecorded: () => Promise.resolve(undefined),
    idsSince(merchantId: MerchantId, since: Date, limit: number): Promise<EventId[]> {
      // Most recent first and capped, which is the order and the bound the rebuild of the window needs.
      // Insertion order is arrival order, so reversing is "most recent first" without comparing
      // instants, and the slice is what keeps a rebuilt window the size the platform promises.
      //
      // Reversed rather than walked backwards by index, and that is not a matter of taste: an index
      // needs a guard for `undefined` (`noUncheckedIndexedAccess`), and that guard made the mutant that
      // starts the walk one past the end **behave the same** — a survivor no test could ever kill,
      // because the code said something no input could distinguish.
      const ids = [...rows]
        .reverse()
        .filter((row) => row.merchantId === merchantId && row.receivedAt.getTime() >= since.getTime())
        .slice(0, limit)
        .map((row) => row.event.eventId);
      return Promise.resolve(ids);
    },
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
