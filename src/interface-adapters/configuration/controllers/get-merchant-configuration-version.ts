// getMerchantConfigurationVersion (feature 042): the merchant and the number of the path → use case → 200 with
// the version, or its problem. The number arrives as the text of the path; `numberOf` reads it.
import { merchantIdOf, numberOf } from "../../http/boundary.js";
import { operatorOf } from "../../http/security/principal.js";
import { HTTP_STATUS } from "../../http/status.js";
import { toProblem } from "../../http/to-problem.js";
import { versionDto } from "../presenters.js";
import type {
  GetMerchantConfigurationVersionRequest,
  GetMerchantConfigurationVersionResponse,
} from "../../../application/configuration/index.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../http/typed.js";

export function makeGetMerchantConfigurationVersion(
  read: UseCase<GetMerchantConfigurationVersionRequest, GetMerchantConfigurationVersionResponse>,
): OperationHandler<"getMerchantConfigurationVersion"> {
  return async (req) => {
    const result = await read.execute({
      actor: operatorOf(req),
      merchantId: merchantIdOf(req.path),
      version: numberOf(req.path.version),
    });
    if (!result.ok) return toProblem(result.error, req.instance);
    return { status: HTTP_STATUS.OK, body: versionDto(result.value) };
  };
}
