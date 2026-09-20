// listMerchantAdminLog (ADR-031): path + paging → use case → 200 with the page, or 403.
import { adminEntryDto, merchantIdOf } from "../../admin-boundary.js";
import { pageDto, pageQueryOf } from "../../boundary.js";
import { operatorOf } from "../../security/principal.js";
import { HTTP_STATUS } from "../../status.js";
import { toProblem } from "../../to-problem.js";
import type {
  ListMerchantAdminLogRequest,
  ListMerchantAdminLogResponse,
} from "../../../../application/admin/index.js";
import type { UseCase } from "../../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../typed.js";

export function makeListMerchantAdminLog(
  listMerchantAdminLog: UseCase<ListMerchantAdminLogRequest, ListMerchantAdminLogResponse>,
): OperationHandler<"listMerchantAdminLog"> {
  return async (req) => {
    const result = await listMerchantAdminLog.execute({
      actor: operatorOf(req),
      merchantId: merchantIdOf(req.path),
      ...pageQueryOf(req.query),
    });
    if (!result.ok) return toProblem(result.error, req.instance);
    return { status: HTTP_STATUS.OK, body: pageDto(result.value, adminEntryDto) };
  };
}
