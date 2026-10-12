// notifyPlatformChange (feature 044, ADR-047; research R-06): the notice → the use case behind the gate of
// `subscribe` → 202 with what is pending, or the Problem Details of the returned error (409 a flow that is not
// subscribed, 503 a store that cannot queue it).
import { merchantOf } from "../../http/security/principal.js";
import { HTTP_STATUS } from "../../http/status.js";
import { toProblem } from "../../http/to-problem.js";
import type { AcceptNoticeRequest, AcceptNoticeResponse } from "../../../application/platform/index.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { Fail, SyncModeNotConfigured } from "../../../domain/shared-kernel/index.js";
import type { OperationHandler } from "../../http/typed.js";

export function makeNotifyPlatformChange(
  acceptNotice: UseCase<AcceptNoticeRequest, AcceptNoticeResponse | Fail<SyncModeNotConfigured>>,
): OperationHandler<"notifyPlatformChange"> {
  return async (req) => {
    const result = await acceptNotice.execute({
      merchantId: merchantOf(req).merchantId,
      flow: req.body.flow,
      reference: req.body.reference,
      state: req.body.state,
    });
    if (!result.ok) return toProblem(result.error, req.instance);
    const { flow, reference, receivedAt } = result.value;
    return { status: HTTP_STATUS.ACCEPTED, body: { flow, reference, receivedAt: receivedAt.toISOString() } };
  };
}
