// notifyOrder (ADR-028): DTO → domain (ids branded, total as Money) → use case → 201 created |
// 200 repeated | the Problem Details of the returned error (422 invariant, 409 conflict, 503
// ledger unavailable). The response carries the status of the order and nothing of the ledger.
import { asOrderId, type Order } from "../../../../domain/outcomes/index.js";
import { asSessionId, Money } from "../../../../domain/shared-kernel/index.js";
import { idempotent, instantOf, linesOf } from "../../boundary.js";
import { merchantOf } from "../../security/principal.js";
import { toProblem } from "../../to-problem.js";
import type { NotifyOrderRequest, NotifyOrderResponse } from "../../../../application/outcomes/index.js";
import type { UseCase } from "../../../../application/shared-kernel/index.js";
import type { components } from "../../generated/api.js";
import type { OperationHandler } from "../../typed.js";

type OrderResultDto = components["schemas"]["OrderResult"];

function toResult(order: Order): OrderResultDto {
  return { orderId: order.orderId, status: order.status(), receivedAt: order.receivedAt.toISOString() };
}

export function makeNotifyOrder(
  notifyOrder: UseCase<NotifyOrderRequest, NotifyOrderResponse>,
): OperationHandler<"notifyOrder"> {
  return async (req) => {
    const merchant = merchantOf(req);
    const { body } = req;
    const result = await notifyOrder.execute({
      merchantId: merchant.merchantId,
      orderId: asOrderId(body.orderId),
      total: Money.rehydrate(body.total),
      items: linesOf(body.items),
      confirmedAt: instantOf(body.confirmedAt),
      // Stryker disable next-line ConditionalExpression: asSessionId is a brand, on undefined it yields undefined
      sessionId: body.sessionId === undefined ? undefined : asSessionId(body.sessionId),
      incentive: body.incentive,
    });
    if (!result.ok) return toProblem(result.error, req.instance);
    return idempotent(result.value.outcome, toResult(result.value.order));
  };
}
