// createExperiment (03 §4.10, D-G; ADR-022): body → use case (the split as a rate) → 201 with the
// experiment, calibrating.
import { merchantIdOf } from "../../admin-boundary.js";
import { experimentDto, PERCENT } from "../../experiment-boundary.js";
import { operatorOf } from "../../security/principal.js";
import { HTTP_STATUS } from "../../status.js";
import { toProblem } from "../../to-problem.js";
import type {
  CreateExperimentRequest,
  CreateExperimentResponse,
} from "../../../../application/experiment/index.js";
import type { UseCase } from "../../../../application/shared-kernel/index.js";
import type { OperationHandler } from "../../typed.js";

export function makeCreateExperiment(
  createExperiment: UseCase<CreateExperimentRequest, CreateExperimentResponse>,
): OperationHandler<"createExperiment"> {
  return async (req) => {
    const result = await createExperiment.execute({
      actor: operatorOf(req),
      merchantId: merchantIdOf(req.path),
      treatmentShare: req.body.treatmentPercent / PERCENT,
      seed: req.body.seed,
      targetSample: req.body.targetSample,
      cuts: req.body.cuts ?? [],
    });
    if (!result.ok) return toProblem(result.error, req.instance);
    return { status: HTTP_STATUS.CREATED, body: experimentDto(result.value) };
  };
}
