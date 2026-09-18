// ingestion module: the event batch. It needs the kernel, the decision ledger, the arm of the
// visitor (experiment module) and its own dedup; it owns (binds) only the dedup, which shares
// the profile's clock.
import { DEDUP_WINDOW, IngestBatchUseCase, type EventDedup } from "../../application/ingestion/index.js";
import { LoggedUseCase, type Clock, type Logger } from "../../application/shared-kernel/index.js";
import { memoryEventDedup } from "../../interface-adapters/gateways/ingestion/memory-event-dedup.js";
import { makeIngestEvents } from "../../interface-adapters/http/controllers/ingestion/ingest-events.js";
import { assignmentServiceOf, type ExperimentPorts } from "./experiment.js";
import type { DecisionIdGenerator, DecisionLedger } from "../../application/ledger/index.js";
import type { Bindings, Module } from "../wiring.js";

export interface IngestionPorts extends ExperimentPorts {
  clock: Clock;
  logger: Logger;
  eventDedup: EventDedup;
  decisions: DecisionLedger;
  decisionIds: DecisionIdGenerator;
}

export const memoryIngestionPorts = (clock: Clock): Bindings<Pick<IngestionPorts, "eventDedup">> => ({
  eventDedup: () => memoryEventDedup(clock, DEDUP_WINDOW),
});

export const ingestionModule: Module<IngestionPorts> = ({ ports }) => {
  const { clock, logger, eventDedup, decisions, decisionIds } = ports;
  const ingestBatch = new IngestBatchUseCase({
    clock,
    decisionIds,
    logger,
    eventDedup,
    decisions,
    assignment: assignmentServiceOf(ports),
  });
  const logged = new LoggedUseCase("ingestBatch", ingestBatch, { clock, logger });
  return { handlers: { ingestEvents: makeIngestEvents(logged) } };
};
