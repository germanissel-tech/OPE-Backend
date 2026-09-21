// getMerchant (ADR-031): path → use case → 200 with the merchant, or 403 / 404 as Problem Details.
import { merchantIdOf } from "../../http/boundary.js";
import { operatorOf } from "../../http/security/principal.js";
import { HTTP_STATUS } from "../../http/status.js";
import { toProblem } from "../../http/to-problem.js";
import { merchantDto } from "../presenters.js";
import type { GetMerchantRequest, GetMerchantResponse } from "../../../application/merchant/index.js";
import type { Clock, UseCase } from "../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../http/typed.js";

export function makeGetMerchant(
  getMerchant: UseCase<GetMerchantRequest, GetMerchantResponse>,
  clock: Clock,
): OperationHandler<"getMerchant"> {
  return async (req) => {
    const result = await getMerchant.execute({ actor: operatorOf(req), merchantId: merchantIdOf(req.path) });
    if (!result.ok) return toProblem(result.error, req.instance);
    return { status: HTTP_STATUS.OK, body: merchantDto(result.value, clock.now()) };
  };
}
