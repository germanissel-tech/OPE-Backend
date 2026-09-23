// ingestion module: the event batch. It owns its deduplication and declares the plane it asks for
// a decision —the decision module binds it— so the ingestion knows nothing of the authorities
// behind that decision (ADR-026).
import {
  IngestBatchUseCase,
  type DecisionPlane,
  type EventDedup,
} from "../../application/ingestion/index.js";
import { makeIngestEvents, memoryEventDedup } from "../../interface-adapters/ingestion/index.js";
import { bind, compositionModule, handler, port } from "../graph/index.js";
import { PlatformConfigurationPort } from "../release.js";
import { ClockPort, ClockTolerancePort, DecoratorsPort } from "./shared-kernel.js";

const EventDedupPort = port("ingestion.dedup")<EventDedup>();
/** What decides a batch; the decision module binds it. */
export const DecisionPlanePort = port("ingestion.decision-plane")<DecisionPlane>();

export const ingestionModule = compositionModule({
  provides: {
    memory: [
      bind(EventDedupPort, { clock: ClockPort, platform: PlatformConfigurationPort }, ({ clock, platform }) =>
        memoryEventDedup(clock, platform.dedupWindow),
      ),
    ],
  },
  serves: {
    handlers: {
      ingestEvents: handler(
        {
          deco: DecoratorsPort,
          clock: ClockPort,
          tolerance: ClockTolerancePort,
          eventDedup: EventDedupPort,
          decisionPlane: DecisionPlanePort,
        },
        // The name of the log is the name of the use case, which is not this operationId.
        (_operation, { deco, ...deps }) =>
          makeIngestEvents(deco.logged("ingestBatch", new IngestBatchUseCase(deps))),
      ),
    },
  },
});
