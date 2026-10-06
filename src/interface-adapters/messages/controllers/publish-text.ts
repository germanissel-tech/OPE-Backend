// publishText (feature 038): body → use case → 201 with the version created, or 200 with the version in
// force it repeats. The key travels in the body because the attribute value is optional, and a route with
// an optional segment does not exist.
import { declaredText, publishedTextAnswer } from "../presenters.js";
import type { PublishTextRequest, PublishTextResponse } from "../../../application/messages/index.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../http/typed.js";

export function makePublishText(
  publish: UseCase<PublishTextRequest, PublishTextResponse>,
): OperationHandler<"publishText"> {
  return async (req) =>
    publishedTextAnswer(await publish.execute({ ...declaredText(req), text: req.body.text }), req.instance);
}
