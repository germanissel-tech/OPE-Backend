// publishPlatformConfiguration (feature 036): body → use case → 201 with the version created, or 200 with
// the version in force it repeats.
//
// **It is the twin of the defaults one and names the other level**, which is the only thing that differs:
// the body of a level, the authority it takes, the freeze and the restarted windows are the same question,
// and what the content means is the business of the reader of each level.
import { publishedLevelAnswer, publishedLevelRequest } from "../presenters.js";
import type { PublishLevelRequest, PublishLevelResponse } from "../../../application/configuration/index.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { components, OperationHandler } from "../../http/typed.js";

export function makePublishPlatformConfiguration(
  publish: UseCase<PublishLevelRequest, PublishLevelResponse>,
): OperationHandler<"publishPlatformConfiguration"> {
  return async (req) =>
    publishedLevelAnswer<Content>(
      await publish.execute(publishedLevelRequest("platform", req)),
      req.instance,
    );
}

/** The content of this level, which is the only thing its answer does not share with the other one. */
type Content = components["schemas"]["PlatformConfigurationContent"];
