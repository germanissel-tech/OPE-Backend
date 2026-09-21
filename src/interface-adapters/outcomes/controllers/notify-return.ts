// notifyReturn (ADR-028): DTO → use case → 201 created | 200 repeated | the Problem Details of
// the returned error (422 order unknown or items not in the order, 409 conflict, 503 ledger
// unavailable). The response says the order is RETURNED and what OPE knows of its correlation.
import { asOrderId, type Order } from "../../../domain/outcomes/index.js";
import { idempotent, instantOf } from "../../http/boundary.js";
import { merchantOf } from "../../http/security/principal.js";
import { toProblem } from "../../http/to-problem.js";
import { linesOf } from "../presenters.js";
import type { NotifyReturnRequest, NotifyReturnResponse } from "../../../application/outcomes/index.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { OperationHandler, components } from "../../http/typed.js";

type ReturnResultDto = components["schemas"]["ReturnResult"];

function toResult(order: Order): ReturnResultDto {
  return {
    orderId: order.orderId,
    status: "RETURNED",
    correlation: order.correlationStatus(),
    receivedAt: (order.returned?.receivedAt ?? order.receivedAt).toISOString(),
  };
}

export function makeNotifyReturn(
  notifyReturn: UseCase<NotifyReturnRequest, NotifyReturnResponse>,
): OperationHandler<"notifyReturn"> {
  return async (req) => {
    const merchant = merchantOf(req);
    const { body } = req;
    const result = await notifyReturn.execute({
      merchantId: merchant.merchantId,
      orderId: asOrderId(body.orderId),
      returnedAt: instantOf(body.returnedAt),
      items: body.items === undefined ? undefined : linesOf(body.items),
    });
    if (!result.ok) return toProblem(result.error, req.instance);
    return idempotent(result.value.outcome, toResult(result.value.order));
  };
}
