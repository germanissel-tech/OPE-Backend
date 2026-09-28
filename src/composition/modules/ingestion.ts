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
  memoryEventLog,
  queuedEventLog,
  randomBatchIds,
  sqliteEventLog,
} from "../../interface-adapters/ingestion/index.js";
import { bind, compositionModule, served, port } from "../graph/index.js";
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
 */
const EventLogPort = port("ingestion.event-log")<EventLog>();

/**
 * What this module provides the same way whichever technology it is asked for. Only the register has
 * two, so listing these twice would be the duplication the gate is right about — and worse than
 * repetition, it would be two places to keep in step for something that has no reason to differ.
 */
const whicheverTechnology = [
  bind(EventDedupPort, { clock: ClockPort, platform: PlatformConfigurationPort }, ({ clock, platform }) =>
    memoryEventDedup(clock, platform.dedupWindow),
  ),
  bind(BatchIdsPort, {}, () => randomBatchIds),
] as const;
/** What decides a batch; the decision module binds it. */
export const DecisionPlanePort = port("ingestion.decision-plane")<DecisionPlane>();

export const ingestionModule = compositionModule({
  provides: {
    memory: [
      ...whicheverTechnology,
      bind(EventLogPort, { logger: LoggerPort, tuning: EventLogTuningPort }, ({ logger, tuning }) =>
        queuedEventLog({ writer: memoryEventLog(), logger, ...tuning }),
      ),
    ],
    sqlite: [
      ...whicheverTechnology,
      bind(
        EventLogPort,
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
        },
        // The name of the log is the name of the use case, which is not this operationId.
        { name: "ingestBatch", build: (deps) => new IngestBatchUseCase(deps) },
        (useCase) => makeIngestEvents(useCase),
      ),
    },
  },
});
