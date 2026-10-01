// publishTreatmentDefaults (feature 036): body → use case → 201 with the version created, or 200 with the
// version in force it repeats.
//
// **The content is not read by shape here**, unlike a merchant's declared values. There the controller reads
// a partial declaration to learn its shape before anything resolves; here the content is a whole level and
// the one that knows its vocabulary is the reader of that level, which the use case asks through the
// configuration service — so the controller stays what it is, a translation.
import { InvalidConfigurationValue } from "../../../domain/configuration/index.js";
import { operatorOf } from "../../http/security/principal.js";
import { HTTP_STATUS } from "../../http/status.js";
import { toProblem } from "../../http/to-problem.js";
import { levelVersionDto } from "../presenters.js";
import type {
  PublishTreatmentDefaultsRequest,
  PublishTreatmentDefaultsResponse,
} from "../../../application/configuration/index.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../http/typed.js";

/** The body field the content lives under: the pointer of an offence starts there. */
const CONTENT = "content";

export function makePublishTreatmentDefaults(
  publish: UseCase<PublishTreatmentDefaultsRequest, PublishTreatmentDefaultsResponse>,
): OperationHandler<"publishTreatmentDefaults"> {
  return async (req) => {
    const result = await publish.execute({
      actor: operatorOf(req),
      content: { ...req.body.content },
      corrective: req.body.corrective ?? false,
      // Spread and not assigned: with `exactOptionalPropertyTypes`, an absent reason is a key that is not
      // there, never a key holding `undefined`.
      ...(req.body.reason === undefined ? {} : { reason: req.body.reason }),
    });
    if (!result.ok) {
      // The reader names the field from the root of the content; the body carries it under `content`.
      const error =
        result.error instanceof InvalidConfigurationValue ? result.error.under(CONTENT) : result.error;
      return toProblem(error, req.instance);
    }
    const body = levelVersionDto(result.value);
    return result.value.outcome === "created"
      ? { status: HTTP_STATUS.CREATED, body }
      : { status: HTTP_STATUS.OK, body };
  };
}
