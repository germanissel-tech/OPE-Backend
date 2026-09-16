// getHealth (FR-047): traduce el valor de dominio ServiceHealth al DTO Health del contrato.
// Recibe el reloj por el puerto Clock; el composition root cablea el del sistema.
import { serviceHealth } from "../domain/health.js";
import type { OperationHandler } from "./typed.js";
import type { Clock } from "../ports/clock.js";

export interface HealthDeps {
  contractVersion: string;
  clock: Clock;
}

export function makeGetHealth({ contractVersion, clock }: HealthDeps): OperationHandler<"getHealth"> {
  return async () => {
    const health = serviceHealth({ now: clock.now(), contractVersion });
    return {
      status: 200,
      body: {
        status: health.status,
        contractVersion: health.contractVersion,
        timestamp: health.timestamp.toISOString(),
      },
    };
  };
}
