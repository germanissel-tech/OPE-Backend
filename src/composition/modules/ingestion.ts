// ingestion module: the event batch.
import { makeIngestBatch, type EventDedup } from "../../application/ingestion/index.js";
import { makeIngestEvents } from "../../interface-adapters/http/controllers/ingestion/ingest-events.js";
import type { DecisionLedger } from "../../application/ledger/index.js";
import type { Clock, IdGenerator } from "../../application/shared-kernel/index.js";
import type { Module } from "../wiring.js";

export interface IngestionPorts {
  clock: Clock;
  ids: IdGenerator;
  eventDedup: EventDedup;
  decisions: DecisionLedger;
}

export const ingestionModule: Module<IngestionPorts> = ({ ports }) => ({
  handlers: { ingestEvents: makeIngestEvents(makeIngestBatch(ports)) },
});
