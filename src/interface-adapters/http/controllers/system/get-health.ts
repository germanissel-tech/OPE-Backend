// getHealth (FR-047): translates the use case result to the contract's Health DTO.
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
