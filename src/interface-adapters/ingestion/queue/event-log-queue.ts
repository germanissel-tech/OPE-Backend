// The queue that puts the register outside the critical path (feature 031, FR-007, FR-017).
//
// It is an `EventLog` that wraps another one: `record` adds to what is pending and returns, the reads
// go straight through, and what is pending is written on an interval and once more when the process
// shuts down. Whoever uses it — the ingestion use case — sees one port and cannot tell.
//
// **Three things about it are decisions and not details:**
//
//   - **A full queue drops the new arrival and says so.** The alternative is to wait for room, and
//     waiting is the one thing FR-007 forbids: the decision path would then be held up by a
//     measurement. Dropping the *new* one rather than the oldest is deliberate too — what is already
//     queued is closer to being written, and throwing it away would waste work already done.
//   - **Draining at shutdown has a ceiling.** `SHUTDOWN_TIMEOUT_MS` is ten seconds and past it the
//     process exits 1, so a drain that waited for an unreachable store would turn the remedy of
//     FR-017 into the hung process `lifecycle.ts` was written to avoid. What does not get out is
//     treated as an abrupt loss, which the register already knows how to declare (FR-018).
//   - **The timer is unreferenced.** A repeating timer keeps the event loop alive, so a process that
//     had nothing else to do would not exit; `unref` means the queue never is the reason something
//     stays up.
import type { EventLog } from "../../../application/ingestion/index.js";
import type { Logger } from "../../../application/shared-kernel/index.js";
import type { RecordedEvent } from "../../../domain/ingestion/index.js";

export interface EventLogQueueDeps {
  /** Where what is pending ends up: the durable register, or the one in memory. */
  readonly writer: EventLog;
  readonly logger: Logger;
  /** Arrivals held at most before they start being dropped. */
  readonly maxArrivals: number;
  /** How often what is pending is written. */
  readonly flushIntervalMs: number;
}

/** What the composition gets: a log, and the `close` the graph calls in reverse creation order. */
export interface EventLogQueue extends EventLog {
  /** Writes what is pending now. The interval calls it; a test calls it instead of waiting. */
  flush(): void;
  /** Drains and stops. The graph closes this **before** the store, because it was built after it. */
  close(): void;
}

export function queuedEventLog(deps: EventLogQueueDeps): EventLogQueue {
  let pending: RecordedEvent[] = [];
  let dropped = 0;

  const flush = (): void => {
    if (pending.length === 0) return;
    // Taken before the write, so an arrival that comes in during it is not lost and not written twice.
    const writing = pending;
    pending = [];
    deps.writer.record(writing);
  };

  const timer = setInterval(flush, deps.flushIntervalMs);
  timer.unref();

  return {
    record(arrivals) {
      for (const arrival of arrivals) {
        if (pending.length >= deps.maxArrivals) {
          dropped += 1;
          continue;
        }
        pending.push(arrival);
      }
      if (dropped > 0) {
        // Said at once rather than counted for later: this is a loss the register cannot reconcile
        // against the ledger, because the decision it belongs to was written perfectly well.
        deps.logger.error(
          { dropped, held: pending.length, max: deps.maxArrivals },
          "The event register queue is full; those arrivals were not recorded.",
        );
        dropped = 0;
      }
    },
    flush,
    close() {
      clearInterval(timer);
      flush();
    },
    byDecision: (merchantId, decisionId) => deps.writer.byDecision(merchantId, decisionId),
    bySession: (merchantId, sessionId) => deps.writer.bySession(merchantId, sessionId),
    byEvent: (merchantId, eventId) => deps.writer.byEvent(merchantId, eventId),
    volume: (merchantId, window) => deps.writer.volume(merchantId, window),
  };
}
