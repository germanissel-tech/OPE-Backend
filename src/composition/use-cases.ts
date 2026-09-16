// Instancia los casos de uso a partir de los puertos. Los controllers reciben esto, no puertos.
import { makeIngestBatch, type IngestBatch } from "../application/ingestion/index.js";
import { makeConfirmExposure, type ConfirmExposure } from "../application/ledger/index.js";
import { makeResolveIngestKey, type ResolveIngestKey } from "../application/merchant/index.js";
import { makeGetServiceHealth, type GetServiceHealth } from "../application/system/index.js";
import type { Ports } from "./ports.js";

export interface UseCases {
  getServiceHealth: GetServiceHealth;
  resolveIngestKey: ResolveIngestKey;
  ingestBatch: IngestBatch;
  confirmExposure: ConfirmExposure;
}

export function buildUseCases(ports: Ports, contractVersion: string): UseCases {
  return {
    getServiceHealth: makeGetServiceHealth({ contractVersion, clock: ports.clock }),
    resolveIngestKey: makeResolveIngestKey(ports.merchants),
    ingestBatch: makeIngestBatch(ports),
    confirmExposure: makeConfirmExposure({
      decisionLedger: ports.decisions,
      exposureLedger: ports.exposures,
    }),
  };
}
