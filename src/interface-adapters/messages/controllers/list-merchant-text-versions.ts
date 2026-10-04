// listMerchantTextVersions (feature 038, US5): the history of a merchant's key, newest first and paginated,
// within the operator's scope over the merchant.
import { merchantIdOf, pageQueryOf } from "../../http/boundary.js";
import { operatorOf } from "../../http/security/principal.js";
import { HTTP_STATUS } from "../../http/status.js";
import { toProblem } from "../../http/to-problem.js";
import { textHistoryPage, textKeyOf } from "../presenters.js";
import type {
  ListMerchantTextVersionsRequest,
  ListMerchantTextVersionsResponse,
} from "../../../application/messages/index.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../http/typed.js";

export function makeListMerchantTextVersions(
  list: UseCase<ListMerchantTextVersionsRequest, ListMerchantTextVersionsResponse>,
): OperationHandler<"listMerchantTextVersions"> {
  return async (req) => {
    const result = await list.execute({
      actor: operatorOf(req),
      merchantId: merchantIdOf(req.path),
      key: textKeyOf(req),
      page: pageQueryOf(req.query),
    });
    if (!result.ok) return toProblem(result.error, req.instance);
    return { status: HTTP_STATUS.OK, body: textHistoryPage(result.value) };
  };
}
