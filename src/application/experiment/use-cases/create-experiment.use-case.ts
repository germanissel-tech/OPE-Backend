// createExperiment (03 §4.10, D-G; ADR-022; ADR-031): opens an experiment for a merchant, in
// calibration. Within the scope of the operator; the split, the seed, the target sample and the
// cuts are judged by the entity; the split may not take the holdout the merchant keeps out of
// OPE; the store admits it only if the merchant has no open experiment.
import {
  Experiment,
  type ExperimentError,
  type ExperimentSetError,
  type TreatmentExceedsHoldout,
} from "../../../domain/experiment/index.js";
import {
  fail,
  ok,
  type MerchantId,
  type Result,
  type StoreUnavailable,
} from "../../../domain/shared-kernel/index.js";
import type { MerchantNotFound } from "../../../domain/merchant/index.js";
import type { MerchantOutOfScope, Operator } from "../../../domain/operator/index.js";
import type { ScopedMerchantService } from "../../merchant/index.js";
import type { Clock, UseCase } from "../../shared-kernel/index.js";
import type { ExperimentIdMinter } from "../ports/experiment-id-minter.js";
import type { ExperimentStore } from "../ports/experiment-store.js";
import type { HoldoutSource } from "../ports/holdout-source.js";

export interface CreateExperimentRequest {
  actor: Operator;
  merchantId: MerchantId;
  /** Share of visitors assigned to TREATMENT, as a rate 0..1. */
  treatmentShare: number;
  seed: string;
  targetSample: number;
  cuts: readonly number[];
}

export type CreateExperimentResponse = Result<
  Experiment,
  | MerchantOutOfScope
  | MerchantNotFound
  | ExperimentError
  | TreatmentExceedsHoldout
  | ExperimentSetError
  | StoreUnavailable
>;

export interface CreateExperimentDependencies {
  scoped: ScopedMerchantService;
  experiments: ExperimentStore;
  holdout: HoldoutSource;
  minter: ExperimentIdMinter;
  clock: Clock;
}

export class CreateExperimentUseCase implements UseCase<CreateExperimentRequest, CreateExperimentResponse> {
  readonly #deps: CreateExperimentDependencies;

  constructor(deps: CreateExperimentDependencies) {
    this.#deps = deps;
  }

  async execute(request: CreateExperimentRequest): Promise<CreateExperimentResponse> {
    const { scoped, experiments, holdout, minter, clock } = this.#deps;
    const found = await scoped.find(request.actor, request.merchantId);
    if (!found.ok) return found;
    const built = Experiment.of({
      experimentId: await minter.mintExperimentId(),
      merchantId: request.merchantId,
      treatmentShare: request.treatmentShare,
      seed: request.seed,
      targetSample: request.targetSample,
      cuts: request.cuts,
      openedAt: clock.now(),
    });
    if (!built.ok) return fail(built.error);
    const fits = built.value.withinHoldout(await holdout.holdoutShareFor(request.merchantId));
    if (!fits.ok) return fits;
    const opened = await experiments.open(fits.value);
    return opened.ok ? ok(opened.value) : opened;
  }
}
