// ingestion module: the event batch. It needs the kernel, its own dedup and the decision plane
// (decision module); it owns (binds) only the dedup, which shares the profile's clock.
import { DEDUP_WINDOW, IngestBatchUseCase, type EventDedup } from "../../application/ingestion/index.js";
import { LoggedUseCase, type Clock, type Logger } from "../../application/shared-kernel/index.js";
import { memoryEventDedup } from "../../interface-adapters/gateways/ingestion/memory-event-dedup.js";
import { makeIngestEvents } from "../../interface-adapters/http/controllers/ingestion/ingest-events.js";
import { decisionPlaneOf, type DecisionPorts } from "./decision.js";
import type { Bindings, Module } from "../wiring.js";

export interface IngestionPorts extends DecisionPorts {
  clock: Clock;
  logger: Logger;
  eventDedup: EventDedup;
}

export const memoryIngestionPorts = (clock: Clock): Bindings<Pick<IngestionPorts, "eventDedup">> => ({
  eventDedup: () => memoryEventDedup(clock, DEDUP_WINDOW),
});

export const ingestionModule: Module<IngestionPorts> = ({ ports }) => {
  const { clock, logger, eventDedup } = ports;
  const ingestBatch = new IngestBatchUseCase({ clock, eventDedup, decisionPlane: decisionPlaneOf(ports) });
  const logged = new LoggedUseCase("ingestBatch", ingestBatch, { clock, logger });
  return { handlers: { ingestEvents: makeIngestEvents(logged) } };
};
