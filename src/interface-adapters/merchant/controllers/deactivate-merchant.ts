// deactivateMerchant (ADR-031): path → use case → 200 with the merchant deactivated.
import { merchantIdOf } from "../../http/boundary.js";
import { operatorOf } from "../../http/security/principal.js";
import { merchantResponse } from "../presenters.js";
import type {
  DeactivateMerchantRequest,
  DeactivateMerchantResponse,
} from "../../../application/merchant/index.js";
import type { Clock, UseCase } from "../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../http/typed.js";

export function makeDeactivateMerchant(
  deactivateMerchant: UseCase<DeactivateMerchantRequest, DeactivateMerchantResponse>,
  clock: Clock,
): OperationHandler<"deactivateMerchant"> {
  return async (req) => {
    const result = await deactivateMerchant.execute({
      actor: operatorOf(req),
      merchantId: merchantIdOf(req.path),
    });
    return merchantResponse(result, req.instance, clock.now());
  };
}
