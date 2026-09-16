// Instancia los casos de uso a partir de los puertos. Los controllers reciben esto, no puertos.
import { makeGetServiceHealth, type GetServiceHealth } from "../application/system/index.js";
import type { Ports } from "./ports.js";

export interface UseCases {
  getServiceHealth: GetServiceHealth;
}

export function buildUseCases(ports: Ports, contractVersion: string): UseCases {
  return {
    getServiceHealth: makeGetServiceHealth({ contractVersion, clock: ports.clock }),
  };
}
