// Eval fixture: a composition root that lists every use case and every controller of the system
// in two central maps (the pre-005 bootstrap): each new operation of any module edits this file.
import { makeIngestBatch, type IngestBatch } from "../application/ingestion/index.js";
import { makeConfirmExposure, type ConfirmExposure } from "../application/ledger/index.js";
import { makeGetServiceHealth, type GetServiceHealth } from "../application/system/index.js";
import { makeIngestEvents } from "../interface-adapters/http/controllers/ingestion/ingest-events.js";
import { makeConfirmExposureHandler } from "../interface-adapters/http/controllers/ledger/confirm-exposure.js";
import { makeGetHealth } from "../interface-adapters/http/controllers/system/get-health.js";

interface Ports {
  clock: { now(): Date };
}

interface UseCases {
  getServiceHealth: GetServiceHealth;
  ingestBatch: IngestBatch;
  confirmExposure: ConfirmExposure;
}

function buildUseCases(ports: Ports): UseCases {
  return {
    getServiceHealth: makeGetServiceHealth(ports),
    ingestBatch: makeIngestBatch(ports),
    confirmExposure: makeConfirmExposure(ports),
  };
}

export function wireControllers(ports: Ports): Record<string, () => Promise<unknown>> {
  const useCases = buildUseCases(ports);
  return {
    getHealth: makeGetHealth(useCases.getServiceHealth),
    ingestEvents: makeIngestEvents(useCases.ingestBatch),
    confirmExposure: makeConfirmExposureHandler(useCases.confirmExposure),
  };
}
