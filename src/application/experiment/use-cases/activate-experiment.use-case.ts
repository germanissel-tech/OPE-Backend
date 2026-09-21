// activateExperiment (03 §4.10, D-G): the calibration ends and the accumulation window starts
// at this instant; from here the configuration of the merchant is frozen (the publication
// checks it). Within the scope of the operator; the transition is the entity's own.
import {
  ok,
  type ExperimentId,
  type MerchantId,
  type Result,
  type StoreUnavailable,
} from "../../../domain/shared-kernel/index.js";
import type { Experiment, ExperimentNotOpen } from "../../../domain/experiment/index.js";
import type { Operator } from "../../../domain/operator/index.js";
import type { Clock, UseCase } from "../../shared-kernel/index.js";
import type { ExperimentStore } from "../ports/experiment-store.js";
import type {
  ExperimentLookupError,
  ExperimentLookupService,
} from "../services/experiment-lookup.service.js";

export interface ActivateExperimentRequest {
  actor: Operator;
  merchantId: MerchantId;
  experimentId: ExperimentId;
}

export type ActivateExperimentResponse = Result<
  Experiment,
  ExperimentLookupError | ExperimentNotOpen | StoreUnavailable
>;

export interface ActivateExperimentDependencies {
  lookup: ExperimentLookupService;
  experiments: ExperimentStore;
  clock: Clock;
}

export class ActivateExperimentUseCase implements UseCase<
  ActivateExperimentRequest,
  ActivateExperimentResponse
> {
  readonly #deps: ActivateExperimentDependencies;

  constructor(deps: ActivateExperimentDependencies) {
    this.#deps = deps;
  }

  async execute(request: ActivateExperimentRequest): Promise<ActivateExperimentResponse> {
    const { lookup, experiments, clock } = this.#deps;
    const found = await lookup.find(request.actor, request.merchantId, request.experimentId);
    if (!found.ok) return found;
    const activated = found.value.activated(clock.now());
    if (!activated.ok) return activated;
    if (activated.value === found.value) return ok(found.value);
    return experiments.update(activated.value);
  }
}
