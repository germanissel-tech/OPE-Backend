// confirmExposure (FR-030, FR-031): DTO → use case → 201 recorded | 200 already-recorded |
// the Problem Details of the returned error (422 invariant, 503 ledger unavailable).
import { asDecisionId, asSessionId, asVisitorId } from "../../../../domain/shared-kernel/index.js";
import { merchantOf } from "../../security/ingest-key.js";
import { toProblem } from "../../to-problem.js";
import type {
  ConfirmExposureRequest,
  ConfirmExposureResponse,
} from "../../../../application/ledger/index.js";
import type { UseCase } from "../../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../typed.js";

export function makeConfirmExposureHandler(
  confirmExposure: UseCase<ConfirmExposureRequest, ConfirmExposureResponse>,
): OperationHandler<"confirmExposure"> {
  return async (req) => {
    const merchant = merchantOf(req);
    const result = await confirmExposure.execute({
      merchantId: merchant.merchantId,
      decisionId: asDecisionId(req.body.decisionId),
      sessionId: asSessionId(req.body.sessionId),
      visitorId: asVisitorId(req.body.visitorId),
      exposedAt: new Date(req.body.exposedAt),
      anchor: req.body.anchor,
    });
    if (!result.ok) return toProblem(result.error, req.instance);
    const body = { decisionId: req.body.decisionId, status: result.value };
    return result.value === "recorded" ? { status: 201, body } : { status: 200, body };
  };
}
