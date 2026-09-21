// publishMerchantConfiguration (01 §14.2, ADR-031): body → the declared values read by shape →
// use case → 201 with the version created, or 200 with the version in force it repeats.
import {
  readDeclaredConfiguration,
  type PublishMerchantConfigurationRequest,
  type PublishMerchantConfigurationResponse,
} from "../../../../application/configuration/index.js";
import { InvalidConfigurationValue } from "../../../../domain/configuration/index.js";
import { merchantIdOf } from "../../admin-boundary.js";
import { versionDto } from "../../configuration-boundary.js";
import { operatorOf } from "../../security/principal.js";
import { HTTP_STATUS } from "../../status.js";
import { toProblem } from "../../to-problem.js";
import type { UseCase } from "../../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../typed.js";

/** The body field the declared values live under: the pointer of an offence starts there. */
const DECLARED = "declared";

export function makePublishMerchantConfiguration(
  publish: UseCase<PublishMerchantConfigurationRequest, PublishMerchantConfigurationResponse>,
): OperationHandler<"publishMerchantConfiguration"> {
  return async (req) => {
    const declared = readDeclaredConfiguration(req.body.declared, DECLARED);
    if (!declared.ok) return toProblem(declared.error, req.instance);
    const result = await publish.execute({
      actor: operatorOf(req),
      merchantId: merchantIdOf(req.path),
      declared: declared.value,
      corrective: req.body.corrective ?? false,
      reason: req.body.reason,
    });
    if (!result.ok) {
      // The resolution names the field from the root of the declared values; the body carries them under `declared`.
      const error =
        result.error instanceof InvalidConfigurationValue ? result.error.under(DECLARED) : result.error;
      return toProblem(error, req.instance);
    }
    const body = versionDto(result.value.version);
    return result.value.outcome === "created"
      ? { status: HTTP_STATUS.CREATED, body }
      : { status: HTTP_STATUS.OK, body };
  };
}
