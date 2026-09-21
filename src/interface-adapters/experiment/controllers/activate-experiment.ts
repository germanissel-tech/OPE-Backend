// activateExperiment (03 §4.10, D-G): path → use case → 200 with the experiment, active.
import { transitionResponse } from "../presenters.js";
import type {
  ActivateExperimentRequest,
  ActivateExperimentResponse,
} from "../../../application/experiment/index.js";
import type { UseCase } from "../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../http/typed.js";

export function makeActivateExperiment(
  activateExperiment: UseCase<ActivateExperimentRequest, ActivateExperimentResponse>,
): OperationHandler<"activateExperiment"> {
  return (req) => transitionResponse(req, activateExperiment);
}
