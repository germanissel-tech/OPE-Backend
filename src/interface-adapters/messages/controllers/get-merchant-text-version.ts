// getMerchantTextVersion (feature 038, US5): one version of a merchant's key, by its number, as it was
// published, within the operator's scope over the merchant.
import { merchantIdOf, numberOf } from "../../http/boundary.js";
import { operatorOf } from "../../http/security/principal.js";
import { textKeyOf, textVersionAnswer } from "../presenters.js";
import type {
  GetMerchantTextVersionRequest,
  GetMerchantTextVersionResponse,
} from "../../../application/messages/index.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../http/typed.js";

export function makeGetMerchantTextVersion(
  read: UseCase<GetMerchantTextVersionRequest, GetMerchantTextVersionResponse>,
): OperationHandler<"getMerchantTextVersion"> {
  return async (req) =>
    textVersionAnswer(
      await read.execute({
        actor: operatorOf(req),
        merchantId: merchantIdOf(req.path),
        key: textKeyOf(req),
        version: numberOf(req.path.version),
      }),
      req.instance,
    );
}
