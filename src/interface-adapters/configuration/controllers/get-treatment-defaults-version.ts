// getTreatmentDefaultsVersion (feature 036, US4): the number of the path → use case → 200 with the version, or 404.
//
// The level it names is the only thing that differs from its twin; what a missing number answers is decided
// by the use case, which is where «the history has gaps on purpose» lives.
import { numberOf } from "../../http/boundary.js";
import { levelVersionAnswer } from "../presenters.js";
import type {
  GetLevelVersionRequest,
  GetLevelVersionResponse,
} from "../../../application/configuration/index.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { components, OperationHandler } from "../../http/typed.js";

export function makeGetTreatmentDefaultsVersion(
  read: UseCase<GetLevelVersionRequest, GetLevelVersionResponse>,
): OperationHandler<"getTreatmentDefaultsVersion"> {
  return async (req) =>
    levelVersionAnswer<Content>(
      await read.execute({ level: "defaults", version: numberOf(req.path.version) }),
      req.instance,
    );
}

/** The content of this level, which is the only thing its answer does not share with the other one. */
type Content = components["schemas"]["TreatmentDefaultsContent"];
