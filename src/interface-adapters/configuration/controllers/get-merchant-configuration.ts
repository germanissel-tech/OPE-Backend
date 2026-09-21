// getMerchantConfiguration (01 §14.2, ADR-031): path → use case → 200 with the effective
// configuration, what the version in force declared, and the three versions.
import { merchantIdOf } from "../../http/boundary.js";
import { operatorOf } from "../../http/security/principal.js";
import { HTTP_STATUS } from "../../http/status.js";
import { toProblem } from "../../http/to-problem.js";
import { declaredDto, effectiveDto } from "../presenters.js";
import type {
  GetMerchantConfigurationRequest,
  GetMerchantConfigurationResponse,
} from "../../../application/configuration/index.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../http/typed.js";

export function makeGetMerchantConfiguration(
  getConfiguration: UseCase<GetMerchantConfigurationRequest, GetMerchantConfigurationResponse>,
): OperationHandler<"getMerchantConfiguration"> {
  return async (req) => {
    const result = await getConfiguration.execute({
      actor: operatorOf(req),
      merchantId: merchantIdOf(req.path),
    });
    if (!result.ok) return toProblem(result.error, req.instance);
    const { effective, declared } = result.value;
    return {
      status: HTTP_STATUS.OK,
      body: {
        effective: effectiveDto(effective),
        declared: declaredDto(declared),
        versions: effective.versions,
      },
    };
  };
}
