// publishMerchantText (feature 038): body → use case → 201 with the version created, or 200 with the
// version in force it repeats. A body with `remove` instead of a text is «remove», which travels to the
// use case as the absence of a text: the schema makes the two exclusive, so nothing is decided here.
import { merchantIdOf } from "../../http/boundary.js";
import { declaredText, publishedTextAnswer } from "../presenters.js";
import type {
  PublishMerchantTextRequest,
  PublishMerchantTextResponse,
} from "../../../application/messages/index.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../http/typed.js";

export function makePublishMerchantText(
  publish: UseCase<PublishMerchantTextRequest, PublishMerchantTextResponse>,
): OperationHandler<"publishMerchantText"> {
  return async (req) =>
    publishedTextAnswer(
      await publish.execute({ ...declaredText(req), merchantId: merchantIdOf(req.path) }),
      req.instance,
    );
}
