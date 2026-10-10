// updateMerchantProfile (ADR-045): body → use case → 200 with the merchant as it is now.
import { merchantIdOf, witnessIn } from "../../http/boundary.js";
import { operatorOf } from "../../http/security/principal.js";
import { merchantResponse, profileOf } from "../presenters.js";
import type {
  UpdateMerchantProfileRequest,
  UpdateMerchantProfileResponse,
} from "../../../application/merchant/index.js";
import type { Clock, UseCase } from "../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../http/typed.js";

export function makeUpdateMerchantProfile(
  updateMerchantProfile: UseCase<UpdateMerchantProfileRequest, UpdateMerchantProfileResponse>,
  clock: Clock,
): OperationHandler<"updateMerchantProfile"> {
  return async (req) => {
    const result = await updateMerchantProfile.execute({
      actor: operatorOf(req),
      merchantId: merchantIdOf(req.path),
      profile: profileOf(req.body),
      witness: witnessIn(req.headers),
    });
    return merchantResponse(result, req.instance, clock.now());
  };
}
