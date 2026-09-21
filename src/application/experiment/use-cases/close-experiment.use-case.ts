// closeExperiment (03 §4.10): terminal — from the next batch nobody is assigned and every
// decision resolves NO_OP no-active-experiment; what was recorded stays. Within the scope of
// the operator; repeating it changes nothing.
import {
  ok,
  type ExperimentId,
  type MerchantId,
  type Result,
  type StoreUnavailable,
} from "../../../domain/shared-kernel/index.js";
import type { Experiment } from "../../../domain/experiment/index.js";
import type { Operator } from "../../../domain/operator/index.js";
import type { Clock, UseCase } from "../../shared-kernel/index.js";
import type { ExperimentStore } from "../ports/experiment-store.js";
import type {
  ExperimentLookupError,
  ExperimentLookupService,
} from "../services/experiment-lookup.service.js";

export interface CloseExperimentRequest {
  actor: Operator;
  merchantId: MerchantId;
  experimentId: ExperimentId;
}

export type CloseExperimentResponse = Result<Experiment, ExperimentLookupError | StoreUnavailable>;

export interface CloseExperimentDependencies {
  lookup: ExperimentLookupService;
  experiments: ExperimentStore;
  clock: Clock;
}

export class CloseExperimentUseCase implements UseCase<CloseExperimentRequest, CloseExperimentResponse> {
  readonly #deps: CloseExperimentDependencies;

  constructor(deps: CloseExperimentDependencies) {
    this.#deps = deps;
  }

  async execute(request: CloseExperimentRequest): Promise<CloseExperimentResponse> {
    const { lookup, experiments, clock } = this.#deps;
    const found = await lookup.find(request.actor, request.merchantId, request.experimentId);
    if (!found.ok) return found;
    const closed = found.value.closed(clock.now());
    return closed === found.value ? ok(found.value) : experiments.update(closed);
  }
}
