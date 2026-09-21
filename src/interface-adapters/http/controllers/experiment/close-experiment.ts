// closeExperiment (03 §4.10): path → use case → 200 with the experiment, closed.
import { transitionResponse } from "../../experiment-boundary.js";
import type {
  CloseExperimentRequest,
  CloseExperimentResponse,
} from "../../../../application/experiment/index.js";
import type { UseCase } from "../../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../typed.js";

export function makeCloseExperiment(
  closeExperiment: UseCase<CloseExperimentRequest, CloseExperimentResponse>,
): OperationHandler<"closeExperiment"> {
  return (req) => transitionResponse(req, closeExperiment);
}
