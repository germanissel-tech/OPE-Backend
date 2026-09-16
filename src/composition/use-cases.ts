// Instancia los casos de uso a partir de los puertos. Los controllers reciben esto, no puertos.
import { makeResolveIngestKey, type ResolveIngestKey } from "../application/merchant/index.js";
import { makeGetServiceHealth, type GetServiceHealth } from "../application/system/index.js";
import type { Ports } from "./ports.js";

export interface UseCases {
  getServiceHealth: GetServiceHealth;
  resolveIngestKey: ResolveIngestKey;
}

export function buildUseCases(ports: Ports, contractVersion: string): UseCases {
  return {
    getServiceHealth: makeGetServiceHealth({ contractVersion, clock: ports.clock }),
    resolveIngestKey: makeResolveIngestKey(ports.merchants),
  };
}
