// createMerchant (ADR-031): DTO → use case → 201 with the merchant and the values of its
// credentials (the only time), or the Problem Details of the returned error.
import { operatorOf } from "../../http/security/principal.js";
import { HTTP_STATUS } from "../../http/status.js";
import { toProblem } from "../../http/to-problem.js";
import { merchantDto } from "../presenters.js";
import type {
  CreateMerchantFailure,
  CreateMerchantRequest,
  CreateMerchantResponse,
} from "../../../application/merchant/index.js";
import type { Clock, UseCase } from "../../../application/shared-kernel/index.js";
import type { Result } from "../../../domain/shared-kernel/index.js";
import type { OperationHandler } from "../../http/typed.js";

export function makeCreateMerchant(
  createMerchant: UseCase<CreateMerchantRequest, Result<CreateMerchantResponse, CreateMerchantFailure>>,
  clock: Clock,
): OperationHandler<"createMerchant"> {
  return async (req) => {
    const result = await createMerchant.execute({
      actor: operatorOf(req),
      origins: req.body.origins,
      signature: req.body.signature,
    });
    if (!result.ok) return toProblem(result.error, req.instance);
    const { merchant, ingestKey, platformKey, platformSecret } = result.value;
    return {
      status: HTTP_STATUS.CREATED,
      body: {
        merchant: merchantDto(merchant, clock.now()),
        credentials: { ingestKey, platformKey, ...(platformSecret === undefined ? {} : { platformSecret }) },
      },
    };
  };
}
