// getTextVersion (feature 038, US5): one version of a base key, by its number, as it was published.
import { numberOf } from "../../http/boundary.js";
import { textKeyOf, textVersionAnswer } from "../presenters.js";
import type { GetTextVersionRequest, GetTextVersionResponse } from "../../../application/messages/index.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../http/typed.js";

export function makeGetTextVersion(
  read: UseCase<GetTextVersionRequest, GetTextVersionResponse>,
): OperationHandler<"getTextVersion"> {
  return async (req) =>
    textVersionAnswer(
      await read.execute({ key: textKeyOf(req), version: numberOf(req.path.version) }),
      req.instance,
    );
}
