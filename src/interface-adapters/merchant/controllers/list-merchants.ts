// listMerchants (ADR-031): paging DTO → use case → 200 with the merchants within the scope.
import { pageDto, pageQueryOf } from "../../http/boundary.js";
import { operatorOf } from "../../http/security/principal.js";
import { HTTP_STATUS } from "../../http/status.js";
import { merchantDto } from "../presenters.js";
import type { ListMerchantsRequest, ListMerchantsResponse } from "../../../application/merchant/index.js";
import type { Clock, UseCase } from "../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../http/typed.js";

export function makeListMerchants(
  listMerchants: UseCase<ListMerchantsRequest, ListMerchantsResponse>,
  clock: Clock,
): OperationHandler<"listMerchants"> {
  return async (req) => {
    const page = await listMerchants.execute({ actor: operatorOf(req), ...pageQueryOf(req.query) });
    const now = clock.now();
    return { status: HTTP_STATUS.OK, body: pageDto(page, (m) => merchantDto(m, now)) };
  };
}
