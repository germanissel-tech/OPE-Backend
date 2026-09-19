// confirmExposure (FR-030, FR-031): DTO → use case → 201 recorded | 200 already-recorded |
// the Problem Details of the returned error (422 invariant, 503 ledger unavailable).
import { asDecisionId } from "../../../../domain/ledger/index.js";
import { asSessionId, asVisitorId } from "../../../../domain/shared-kernel/index.js";
import { idempotent, instantOf } from "../../boundary.js";
import { merchantOf } from "../../security/principal.js";
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
      exposedAt: instantOf(req.body.exposedAt),
      anchor: req.body.anchor,
    });
    if (!result.ok) return toProblem(result.error, req.instance);
    const body = { decisionId: req.body.decisionId, status: result.value };
    return idempotent(result.value === "recorded" ? "created" : "repeated", body);
  };
}
