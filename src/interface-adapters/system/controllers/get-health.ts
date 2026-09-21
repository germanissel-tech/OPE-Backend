// getHealth (FR-047): translates the use case result to the contract's Health DTO.
import { HTTP_STATUS } from "../../http/status.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { ServiceHealth } from "../../../domain/system/index.js";
import type { OperationHandler } from "../../http/typed.js";

export function makeGetHealth(getServiceHealth: UseCase<void, ServiceHealth>): OperationHandler<"getHealth"> {
  return async () => {
    const health = await getServiceHealth.execute();
    return {
      status: HTTP_STATUS.OK,
      body: {
        status: health.status,
        contractVersion: health.contractVersion,
        timestamp: health.timestamp.toISOString(),
      },
    };
  };
}
