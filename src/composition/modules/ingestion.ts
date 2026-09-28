// ingestion module: the event batch. It owns its deduplication and declares the plane it asks for
// a decision —the decision module binds it— so the ingestion knows nothing of the authorities
// behind that decision (ADR-026).
import {
  IngestBatchUseCase,
  type BatchIdGenerator,
  type DecisionPlane,
  type EventDedup,
} from "../../application/ingestion/index.js";
import {
  makeIngestEvents,
  memoryEventDedup,
  randomBatchIds,
} from "../../interface-adapters/ingestion/index.js";
import { bind, compositionModule, served, port } from "../graph/index.js";
import { PlatformConfigurationPort } from "../release.js";
import { ClockPort, ClockTolerancePort } from "./shared-kernel.js";

const EventDedupPort = port("ingestion.dedup")<EventDedup>();
/** Who mints the identity of an arrival: ingestion's own, because ingestion is what receives it. */
const BatchIdsPort = port("ingestion.batch-ids")<BatchIdGenerator>();
/** What decides a batch; the decision module binds it. */
export const DecisionPlanePort = port("ingestion.decision-plane")<DecisionPlane>();

export const ingestionModule = compositionModule({
  provides: [
    bind(EventDedupPort, { clock: ClockPort, platform: PlatformConfigurationPort }, ({ clock, platform }) =>
      memoryEventDedup(clock, platform.dedupWindow),
    ),
    bind(BatchIdsPort, {}, () => randomBatchIds),
  ],
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
