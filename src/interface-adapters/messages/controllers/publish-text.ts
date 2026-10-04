// publishText (feature 038): body → use case → 201 with the version created, or 200 with the version in
// force it repeats. The key travels in the body because the attribute value is optional, and a route with
// an optional segment does not exist.
import { operatorOf } from "../../http/security/principal.js";
import { publishedTextAnswer } from "../presenters.js";
import type { PublishTextRequest, PublishTextResponse } from "../../../application/messages/index.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../http/typed.js";

export function makePublishText(
  publish: UseCase<PublishTextRequest, PublishTextResponse>,
): OperationHandler<"publishText"> {
  return async (req) => {
    const { body } = req;
    const result = await publish.execute({
      actor: operatorOf(req),
      key: {
        family: body.family,
        ...(body.attributeValue === undefined ? {} : { attributeValue: body.attributeValue }),
        locale: body.locale,
      },
      text: body.text,
      corrective: body.corrective ?? false,
      // Handed over as it comes, absent or not: the guard that turns «undefined» into «not there» lives
      // once, in the use case.
      reason: body.reason,
    });
    return publishedTextAnswer(result, req.instance);
  };
}
