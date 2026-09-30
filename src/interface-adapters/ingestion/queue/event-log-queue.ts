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
  /**
   * Whether somebody else's unit of work is open on the store **right now** (feature 034).
   *
   * Asked and not awaited, which is the whole reason it has this shape: `flush` is synchronous and
   * `record` returns `void` so that nobody can wait for the register (ADR-039), and an `await` here
   * would be a regression of principle IV let in through the side door. Where there is no store there
   * is no unit either, and the deployment that has none binds the answer that says so.
   */
  readonly busy: () => boolean;
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
    // **Somebody else's unit of work is open: this is not the moment, and there is a next one.** The
    // arrivals stay where they are, which is the difference between a delay and a loss — the write would
    // otherwise reach the store, be refused for not having waited its turn, and be logged as lost.
    // Asked on every flush and never remembered: a unit lasts one local write.
    if (deps.busy()) return;
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
      // **The one time "next time" does not exist.** The server closes before the store and waits for
      // its requests, so a unit still open here is already unusual — and every other loss of the
      // register says so out loud (FR-018), which is the only reason this one does too.
      if (pending.length > 0) {
        deps.logger.error(
          { held: pending.length },
          "A unit of work was open when the event register drained; those arrivals were not recorded.",
        );
      }
    },
    // Asked at start-up, when nothing is queued yet, so the queue has nothing to add to the answer —
    // and asking it later would report its own backlog as a hole (see the port).
    unrecorded: () => deps.writer.unrecorded(),
    byDecision: (merchantId, decisionId) => deps.writer.byDecision(merchantId, decisionId),
    bySession: (merchantId, sessionId) => deps.writer.bySession(merchantId, sessionId),
    byEvent: (merchantId, eventId) => deps.writer.byEvent(merchantId, eventId),
    volume: (merchantId, window) => deps.writer.volume(merchantId, window),
    // What is still queued is **not** in this answer, and that is the honest shape of the rebuild it
    // serves (feature 033): it is asked the first time a merchant appears after a start, when nothing
    // of that merchant is queued yet. Draining here to be thorough would make a read of the
    // measurement side write, which is the one thing this queue exists to keep off the hot path.
    idsSince: (merchantId, since, limit) => deps.writer.idsSince(merchantId, since, limit),
  };
}
