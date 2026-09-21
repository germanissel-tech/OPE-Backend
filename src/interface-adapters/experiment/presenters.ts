// What the experiment controllers share at the boundary (ADR-022, ADR-031): the experiment as
// the contract publishes it (the split as a whole percentage, instants as text, never the seed)
// and the experiment identifier of the path.
import {
  asExperimentId,
  type ExperimentId,
  type MerchantId,
  type Result,
} from "../../domain/shared-kernel/index.js";
import { merchantIdOf } from "../http/boundary.js";
import { operatorOf } from "../http/security/principal.js";
import { HTTP_STATUS } from "../http/status.js";
import { toProblem, type CataloguedError, type ProblemOf } from "../http/to-problem.js";
import type { UseCase } from "../../application/shared-kernel/index.js";
import type { Experiment } from "../../domain/experiment/index.js";
import type { Operator } from "../../domain/operator/index.js";
import type { TypedRequest, components, operations } from "../http/typed.js";

type ExperimentDto = components["schemas"]["Experiment"];

/** The percentage of the edge ↔ the rate of the domain. */
export const PERCENT = 100;

export function experimentDto(experiment: Experiment): ExperimentDto {
  const { activatedAt, windowStartedAt, closedAt } = experiment;
  return {
    experimentId: experiment.experimentId,
    status: experiment.status,
    treatmentPercent: Math.round(experiment.treatmentShare * PERCENT),
    targetSample: experiment.targetSample,
    cuts: [...experiment.cuts],
    openedAt: experiment.openedAt.toISOString(),
    ...(activatedAt === undefined ? {} : { activatedAt: activatedAt.toISOString() }),
    ...(windowStartedAt === undefined ? {} : { windowStartedAt: windowStartedAt.toISOString() }),
    ...(closedAt === undefined ? {} : { closedAt: closedAt.toISOString() }),
    windowRestarts: experiment.windowRestarts.map((r) => ({
      at: r.at.toISOString(),
      reason: r.reason,
      configurationVersion: r.configurationVersion,
    })),
  };
}

/** The experiment identifier of the path. */
function experimentIdOf(path: { experimentId: string }): ExperimentId {
  return asExperimentId(path.experimentId);
}

/** A transition of an experiment: the operator, the merchant and the experiment of the path. */
export interface TransitionRequest {
  actor: Operator;
  merchantId: MerchantId;
  experimentId: ExperimentId;
}

type TransitionHttpRequest = TypedRequest<operations["activateExperiment"]>;

/** Activate and close share one shape: path → use case → 200 with the experiment as it is now. */
export async function transitionResponse<E extends CataloguedError>(
  req: Pick<TransitionHttpRequest, "security" | "path" | "instance">,
  transition: UseCase<TransitionRequest, Result<Experiment, E>>,
): Promise<{ status: typeof HTTP_STATUS.OK; body: ExperimentDto } | ProblemOf<E>> {
  const result = await transition.execute({
    actor: operatorOf(req),
    merchantId: merchantIdOf(req.path),
    experimentId: experimentIdOf(req.path),
  });
  if (!result.ok) return toProblem(result.error, req.instance);
  return { status: HTTP_STATUS.OK, body: experimentDto(result.value) };
}
