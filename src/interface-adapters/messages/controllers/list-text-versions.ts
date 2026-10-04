// listTextVersions (feature 038, US5): the history of a base key, newest first and paginated.
import { pageQueryOf } from "../../http/boundary.js";
import { HTTP_STATUS } from "../../http/status.js";
import { textHistoryPage, textKeyOf } from "../presenters.js";
import type { ListTextVersionsRequest } from "../../../application/messages/index.js";
import type { Page, UseCase } from "../../../application/shared-kernel/index.js";
import type { TextVersion } from "../../../domain/messages/index.js";
import type { OperationHandler } from "../../http/typed.js";

export function makeListTextVersions(
  list: UseCase<ListTextVersionsRequest, Page<TextVersion>>,
): OperationHandler<"listTextVersions"> {
  return async (req) => ({
    status: HTTP_STATUS.OK,
    body: textHistoryPage(await list.execute({ key: textKeyOf(req), page: pageQueryOf(req.query) })),
  });
}
