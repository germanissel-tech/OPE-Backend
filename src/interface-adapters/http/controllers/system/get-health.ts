// getHealth (FR-047): traduce el resultado del caso de uso al DTO Health del contrato.
import type { GetServiceHealth } from "../../../../application/system/index.js";
import type { OperationHandler } from "../../typed.js";

export function makeGetHealth(getServiceHealth: GetServiceHealth): OperationHandler<"getHealth"> {
  return async () => {
    const health = getServiceHealth();
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
