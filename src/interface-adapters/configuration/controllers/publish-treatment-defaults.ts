// publishTreatmentDefaults (feature 036): body → use case → 201 with the version created, or 200 with the
// version in force it repeats.
//
// **The content is not read by shape here**, unlike a merchant's declared values. There the controller reads
// a partial declaration to learn its shape before anything resolves; here the content is a whole level and
// the one that knows its vocabulary is the reader of that level, which the use case asks through the
// configuration service — so the controller stays what it is, a translation.
//
// What it adds to the translation its twin shares is the one thing that differs: **which level it is**.
import { publishedLevelAnswer, publishedLevelRequest } from "../presenters.js";
import type { PublishLevelRequest, PublishLevelResponse } from "../../../application/configuration/index.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { components, OperationHandler } from "../../http/typed.js";

export function makePublishTreatmentDefaults(
  publish: UseCase<PublishLevelRequest, PublishLevelResponse>,
): OperationHandler<"publishTreatmentDefaults"> {
  return async (req) =>
    publishedLevelAnswer<Content>(
      await publish.execute(publishedLevelRequest("defaults", req)),
      req.instance,
    );
}

/** The content of this level, which is the only thing its answer does not share with the other one. */
type Content = components["schemas"]["TreatmentDefaultsContent"];
