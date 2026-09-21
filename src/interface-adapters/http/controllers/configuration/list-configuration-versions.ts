// listConfigurationVersions (FR-012, ADR-031): path + paging → use case → 200 with the page.
import { merchantPageResponse } from "../../admin-boundary.js";
import { versionDto } from "../../configuration-boundary.js";
import type {
  ListConfigurationVersionsRequest,
  ListConfigurationVersionsResponse,
} from "../../../../application/configuration/index.js";
import type { UseCase } from "../../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../typed.js";

export function makeListConfigurationVersions(
  listVersions: UseCase<ListConfigurationVersionsRequest, ListConfigurationVersionsResponse>,
): OperationHandler<"listConfigurationVersions"> {
  return (req) => merchantPageResponse(req, listVersions, versionDto);
}
