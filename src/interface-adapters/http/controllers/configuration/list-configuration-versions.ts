// listConfigurationVersions (FR-012, ADR-031): path + paging → use case → 200 with the page.
import { merchantIdOf } from "../../admin-boundary.js";
import { pageDto, pageQueryOf } from "../../boundary.js";
import { versionDto } from "../../configuration-boundary.js";
import { operatorOf } from "../../security/principal.js";
import { HTTP_STATUS } from "../../status.js";
import { toProblem } from "../../to-problem.js";
import type {
  ListConfigurationVersionsRequest,
  ListConfigurationVersionsResponse,
} from "../../../../application/configuration/index.js";
import type { UseCase } from "../../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../typed.js";

export function makeListConfigurationVersions(
  listVersions: UseCase<ListConfigurationVersionsRequest, ListConfigurationVersionsResponse>,
): OperationHandler<"listConfigurationVersions"> {
  return async (req) => {
    const result = await listVersions.execute({
      actor: operatorOf(req),
      merchantId: merchantIdOf(req.path),
      page: pageQueryOf(req.query),
    });
    if (!result.ok) return toProblem(result.error, req.instance);
    return { status: HTTP_STATUS.OK, body: pageDto(result.value, versionDto) };
  };
}
