// corroborateOrder (ADR-028): DTO → use case → 202 (first time or repeated) | the Problem
// Details of the returned error (422 invariant, 503 ledger unavailable).
import { asOrderId } from "../../../../domain/outcomes/index.js";
import { asSessionId, asVisitorId } from "../../../../domain/shared-kernel/index.js";
import { instantOf } from "../../boundary.js";
import { merchantOf } from "../../security/principal.js";
import { HTTP_STATUS } from "../../status.js";
import { toProblem } from "../../to-problem.js";
import type {
  CorroborateOrderRequest,
  CorroborateOrderResponse,
} from "../../../../application/outcomes/index.js";
import type { UseCase } from "../../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../typed.js";

export function makeCorroborateOrder(
  corroborate: UseCase<CorroborateOrderRequest, CorroborateOrderResponse>,
): OperationHandler<"corroborateOrder"> {
  return async (req) => {
    const merchant = merchantOf(req);
    const result = await corroborate.execute({
      merchantId: merchant.merchantId,
      orderId: asOrderId(req.body.orderId),
      sessionId: asSessionId(req.body.sessionId),
      visitorId: asVisitorId(req.body.visitorId),
      confirmedAt: instantOf(req.body.confirmedAt),
    });
    if (!result.ok) return toProblem(result.error, req.instance);
    return {
      status: HTTP_STATUS.ACCEPTED,
      body: { orderId: req.body.orderId, receivedAt: result.value.receivedAt.toISOString() },
    };
  };
}
