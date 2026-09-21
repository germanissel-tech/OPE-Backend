// reportAnchorDiagnostics (01 §3.1.1): body → use case (the merchant of the credential) → 202
// with how many anchors the report carried.
import { merchantOf } from "../../security/principal.js";
import { HTTP_STATUS } from "../../status.js";
import { toProblem } from "../../to-problem.js";
import type {
  ReportAnchorDiagnosticsRequest,
  ReportAnchorDiagnosticsResponse,
} from "../../../../application/admin/index.js";
import type { UseCase } from "../../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../typed.js";

export function makeReportAnchorDiagnostics(
  reportAnchorDiagnostics: UseCase<ReportAnchorDiagnosticsRequest, ReportAnchorDiagnosticsResponse>,
): OperationHandler<"reportAnchorDiagnostics"> {
  return async (req) => {
    const result = await reportAnchorDiagnostics.execute({
      merchantId: merchantOf(req).merchantId,
      configurationVersion: req.body.configurationVersion,
      unresolved: req.body.unresolved,
    });
    if (!result.ok) return toProblem(result.error, req.instance);
    return { status: HTTP_STATUS.ACCEPTED, body: { received: result.value.received } };
  };
}
