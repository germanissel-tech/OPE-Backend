// listAnchorDiagnostics (01 §3.1.1; ADR-031): path + paging → use case → 200 with the page.
import { anchorDiagnosticDto, merchantPageResponse } from "../../admin-boundary.js";
import type {
  ListAnchorDiagnosticsRequest,
  ListAnchorDiagnosticsResponse,
} from "../../../../application/admin/index.js";
import type { UseCase } from "../../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../typed.js";

export function makeListAnchorDiagnostics(
  listAnchorDiagnostics: UseCase<ListAnchorDiagnosticsRequest, ListAnchorDiagnosticsResponse>,
): OperationHandler<"listAnchorDiagnostics"> {
  return (req) => merchantPageResponse(req, listAnchorDiagnostics, anchorDiagnosticDto);
}
