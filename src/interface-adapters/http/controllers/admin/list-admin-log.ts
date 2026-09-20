// listAdminLog (ADR-031): paging DTO → use case → 200 with the page. The operator only has
// to be authenticated: the log is of the platform and every entry names its merchant.
import { pageDto, pageQueryOf } from "../../boundary.js";
import { operatorOf } from "../../security/principal.js";
import { HTTP_STATUS } from "../../status.js";
import type { ListAdminLogRequest, ListAdminLogResponse } from "../../../../application/admin/index.js";
import type { UseCase } from "../../../../application/shared-kernel/index.js";
import type { AdminEntry, AdminResult } from "../../../../domain/admin/index.js";
import type { components } from "../../generated/api.js";
import type { OperationHandler } from "../../typed.js";

type AdminEntryDto = components["schemas"]["AdminEntry"];
type AdminResultDto = components["schemas"]["AdminResult"];

/** Only the fields the action produced. */
function resultDto(result: AdminResult): AdminResultDto {
  return {
    ...(result.configurationVersion === undefined
      ? {}
      : { configurationVersion: result.configurationVersion }),
    ...(result.experimentId === undefined ? {} : { experimentId: result.experimentId }),
    ...(result.windowRestarted === undefined ? {} : { windowRestarted: result.windowRestarted }),
  };
}

/** The entry as the contract publishes it: instants as text, optional fields only when present. */
function adminEntryDto(entry: AdminEntry): AdminEntryDto {
  return {
    at: entry.at.toISOString(),
    operatorId: entry.operatorId,
    operation: entry.operation,
    outcome: entry.outcome,
    ...(entry.merchantId === undefined ? {} : { merchantId: entry.merchantId }),
    ...(entry.code === undefined ? {} : { code: entry.code }),
    ...(entry.result === undefined ? {} : { result: resultDto(entry.result) }),
    ...(entry.reason === undefined ? {} : { reason: entry.reason }),
  };
}

export function makeListAdminLog(
  listAdminLog: UseCase<ListAdminLogRequest, ListAdminLogResponse>,
): OperationHandler<"listAdminLog"> {
  return async (req) => {
    const page = await listAdminLog.execute({ actor: operatorOf(req), ...pageQueryOf(req.query) });
    return { status: HTTP_STATUS.OK, body: pageDto(page, adminEntryDto) };
  };
}
