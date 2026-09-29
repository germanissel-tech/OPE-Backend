// ingestion module: the event batch. It owns its deduplication and declares the plane it asks for
// a decision —the decision module binds it— so the ingestion knows nothing of the authorities
// behind that decision (ADR-026).
import {
  IngestBatchUseCase,
  type BatchIdGenerator,
  type DecisionPlane,
  type EventDedup,
  type EventLog,
} from "../../application/ingestion/index.js";
import {
  makeIngestEvents,
  memoryEventDedup,
  recoveringEventDedup,
  memoryEventLog,
  queuedEventLog,
  randomBatchIds,
  sqliteEventLog,
  type EventLogQueue,
} from "../../interface-adapters/ingestion/index.js";
import { bind, bindAll, compositionModule, served, port } from "../graph/index.js";
import { EventLogTuningPort, PlatformConfigurationPort, SqlStorePort } from "../release.js";
import { ClockPort, ClockTolerancePort, LoggerPort } from "./shared-kernel.js";

const EventDedupPort = port("ingestion.dedup")<EventDedup>();
/** Who mints the identity of an arrival: ingestion's own, because ingestion is what receives it. */
const BatchIdsPort = port("ingestion.batch-ids")<BatchIdGenerator>();
/**
 * The register of what the SDK sends (feature 031). **Always the queue**, whichever technology writes
 * behind it: what puts the register outside the critical path is the queue and not the store, so a
 * deployment that wrote straight through would be a deployment where FR-007 does not hold.
 *
 * It is created **after** the store, so the graph — which closes in reverse creation order — drains it
 * before closing what it writes to (FR-017).
 *
 * **Two ports, one instance**, which is what `bindAll` is for: the queue is what the graph drains and
 * the log is what the use case depends on, and they are the same object resolved once.
 *
 * Why not one port typed as the queue: that was tried and `check:ports-bound` was right to refuse it —
 * the port a use case depends on belongs to the application, and naming an adapters type there inverts
 * the dependency the ring rules keep pointing inwards. Why not a second binding that hands the first
 * one on: the graph memoises per binding, so the same object would be collected as closable twice.
 *
 * What the second view buys is a handle for whoever legitimately needs the queue **as a queue**, and
 * feature 032 needs exactly that: a fake clock can make a session go quiet but cannot make the flush
 * interval fire, so a test that evicts a session flushes the register the way real time would have.
 */
export const EventLogQueuePort = port("ingestion.event-log-queue")<EventLogQueue>();
export const EventLogPort = port("ingestion.event-log")<EventLog>();

/**
 * What this module provides the same way whichever technology it is asked for. Two of its three
 * components do differ — the register writes where the deployment says, and the deduplication window is
 * rebuilt only where there is something to rebuild from — and who mints the identity of an arrival has
 * no reason to.
 */
const whicheverTechnology = [bind(BatchIdsPort, {}, () => randomBatchIds)] as const;
/** What decides a batch; the decision module binds it. */
export const DecisionPlanePort = port("ingestion.decision-plane")<DecisionPlane>();

export const ingestionModule = compositionModule({
  provides: {
    memory: [
      ...whicheverTechnology,
      // Nothing to rebuild from: a deployment with everything in memory loses the register in the same
      // restart that loses the window, so wrapping it would be a rebuild out of what was also forgotten.
      bind(EventDedupPort, { clock: ClockPort, platform: PlatformConfigurationPort }, ({ clock, platform }) =>
        memoryEventDedup(clock, platform.dedupWindow),
      ),
      bindAll(
        [EventLogQueuePort, EventLogPort],
        { logger: LoggerPort, tuning: EventLogTuningPort },
        ({ logger, tuning }) => queuedEventLog({ writer: memoryEventLog(), logger, ...tuning }),
      ),
    ],
    sqlite: [
      ...whicheverTechnology,
      // The window is still answered from memory — it is a `Map.get` on the path of every batch — and
      // what the restart lost is rebuilt from the register the first time each merchant appears
      // (feature 033, US3). Recoverable, not durable, and the gateway says what that is worth.
      bind(
        EventDedupPort,
        {
          clock: ClockPort,
          platform: PlatformConfigurationPort,
          register: EventLogPort,
          logger: LoggerPort,
        },
        ({ clock, platform, register, logger }) =>
          recoveringEventDedup({
            dedup: memoryEventDedup(clock, platform.dedupWindow),
            register,
            clock,
            window: platform.dedupWindow,
            logger,
          }),
      ),
      bindAll(
        [EventLogQueuePort, EventLogPort],
        { store: SqlStorePort, logger: LoggerPort, tuning: EventLogTuningPort },
        ({ store, logger, tuning }) =>
          queuedEventLog({ writer: sqliteEventLog({ store, logger }), logger, ...tuning }),
      ),
    ],
  },
  serves: {
    handlers: {
      ingestEvents: served(
        {
          clock: ClockPort,
          tolerance: ClockTolerancePort,
          eventDedup: EventDedupPort,
          decisionPlane: DecisionPlanePort,
          eventLog: EventLogPort,
          batchIds: BatchIdsPort,
        },
        // The name of the log is the name of the use case, which is not this operationId.
        { name: "ingestBatch", build: (deps) => new IngestBatchUseCase(deps) },
        (useCase) => makeIngestEvents(useCase),
      ),
    },
  },
});
