// listAdminLog (ADR-031): paging DTO → use case → 200 with the page. The operator only has
// to be authenticated: the log is of the platform and every entry names its merchant.
import { pageDto, pageQueryOf } from "../../http/boundary.js";
import { operatorOf } from "../../http/security/principal.js";
import { HTTP_STATUS } from "../../http/status.js";
import { adminEntryDto } from "../presenters.js";
import type { ListAdminLogRequest, ListAdminLogResponse } from "../../../application/admin/index.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../http/typed.js";

export function makeListAdminLog(
  listAdminLog: UseCase<ListAdminLogRequest, ListAdminLogResponse>,
): OperationHandler<"listAdminLog"> {
  return async (req) => {
    const page = await listAdminLog.execute({ actor: operatorOf(req), ...pageQueryOf(req.query) });
    return { status: HTTP_STATUS.OK, body: pageDto(page, adminEntryDto) };
  };
}
