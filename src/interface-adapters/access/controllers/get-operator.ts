import { operatorOf } from "../../http/security/principal.js";
import { HTTP_STATUS } from "../../http/status.js";
import { operatorDto } from "../presenters.js";
import type { GetOperatorRequest, GetOperatorResponse } from "../../../application/access/index.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../http/typed.js";

/** `getOperator` (ADR-044): the principal the security handler resolved, as the contract publishes it. */
export function makeGetOperator(
  getOperator: UseCase<GetOperatorRequest, GetOperatorResponse>,
): OperationHandler<"getOperator"> {
  return async (req) => {
    const operator = await getOperator.execute({ actor: operatorOf(req) });
    return { status: HTTP_STATUS.OK, body: operatorDto(operator) };
  };
}
