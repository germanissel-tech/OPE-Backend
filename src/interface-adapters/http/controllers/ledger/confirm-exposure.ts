// confirmExposure (FR-030, FR-031): DTO → use case → 201 recorded | 200 already-recorded |
// 422 with the type of the invariant.
import { asDecisionId, asSessionId, asVisitorId } from "../../../../domain/shared-kernel/index.js";
import { problem } from "../../problem-details.js";
import { merchantOf } from "../../security/ingest-key.js";
import type { ConfirmExposure } from "../../../../application/ledger/index.js";
import type { OperationHandler } from "../../typed.js";

export function makeConfirmExposureHandler(
  confirmExposure: ConfirmExposure,
): OperationHandler<"confirmExposure"> {
  return async (req) => {
    const merchant = merchantOf(req);
    const result = await confirmExposure({
      merchantId: merchant.merchantId,
      decisionId: asDecisionId(req.body.decisionId),
      sessionId: asSessionId(req.body.sessionId),
      visitorId: asVisitorId(req.body.visitorId),
      exposedAt: new Date(req.body.exposedAt),
      anchor: req.body.anchor,
    });
    if (!result.ok) {
      const { status, body } = problem(result.invariant, { instance: req.instance, detail: result.detail });
      return { status: 422, body: { ...body, status } };
    }
    const body = { decisionId: req.body.decisionId, status: result.status };
    return result.status === "recorded" ? { status: 201, body } : { status: 200, body };
  };
}
