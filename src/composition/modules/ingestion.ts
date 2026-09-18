// ingestion module: the event batch. It needs the kernel, the decision ledger, the arm of the
// visitor (experiment module) and its own dedup; it owns (binds) only the dedup, which shares
// the profile's clock.
import { IngestBatchUseCase, type EventDedup } from "../../application/ingestion/index.js";
import { memoryEventDedup } from "../../interface-adapters/gateways/ingestion/memory-event-dedup.js";
import { makeIngestEvents } from "../../interface-adapters/http/controllers/ingestion/ingest-events.js";
import { assignmentServiceOf, type ExperimentPorts } from "./experiment.js";
import type { DecisionLedger } from "../../application/ledger/index.js";
import type { Clock, IdGenerator, Logger } from "../../application/shared-kernel/index.js";
import type { Bindings, Module } from "../wiring.js";

export interface IngestionPorts extends ExperimentPorts {
  clock: Clock;
  ids: IdGenerator;
  logger: Logger;
  eventDedup: EventDedup;
  decisions: DecisionLedger;
}

export const memoryIngestionPorts = (clock: Clock): Bindings<Pick<IngestionPorts, "eventDedup">> => ({
  eventDedup: () => memoryEventDedup(clock),
});

export const ingestionModule: Module<IngestionPorts> = ({ ports }) => {
  const { clock, ids, logger, eventDedup, decisions } = ports;
  const ingestBatch = new IngestBatchUseCase({
    clock,
    ids,
    logger,
    eventDedup,
    decisions,
    assignment: assignmentServiceOf(ports),
  });
  return { handlers: { ingestEvents: makeIngestEvents(ingestBatch) } };
};
