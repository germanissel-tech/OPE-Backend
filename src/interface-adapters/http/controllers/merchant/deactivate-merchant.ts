// deactivateMerchant (ADR-031): path → use case → 200 with the merchant deactivated.
import { merchantDto, merchantIdOf } from "../../admin-boundary.js";
import { operatorOf } from "../../security/principal.js";
import { HTTP_STATUS } from "../../status.js";
import { toProblem } from "../../to-problem.js";
import type {
  DeactivateMerchantRequest,
  DeactivateMerchantResponse,
} from "../../../../application/merchant/index.js";
import type { Clock, UseCase } from "../../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../typed.js";

export function makeDeactivateMerchant(
  deactivateMerchant: UseCase<DeactivateMerchantRequest, DeactivateMerchantResponse>,
  clock: Clock,
): OperationHandler<"deactivateMerchant"> {
  return async (req) => {
    const result = await deactivateMerchant.execute({
      actor: operatorOf(req),
      merchantId: merchantIdOf(req.path),
    });
    if (!result.ok) return toProblem(result.error, req.instance);
    return { status: HTTP_STATUS.OK, body: merchantDto(result.value, clock.now()) };
  };
}
