// getHealth (FR-047): estado del servicio, versión del contrato cargado y marca de tiempo.
// Función pura: el reloj se inyecta desde el composition root.
import type { OperationHandler } from "../server/handlers.js";

export interface HealthDeps {
  contractVersion: string;
  now: () => Date;
}

export function makeGetHealth({ contractVersion, now }: HealthDeps): OperationHandler<"getHealth"> {
  return async () => ({
    status: 200,
    body: { status: "ok", contractVersion, timestamp: now().toISOString() },
  });
}
