// Application service: an experiment of a merchant within the scope of the operator. It is the
// scoped merchant of the merchant module plus one step — the scope and the existence of the
// merchant first (403 and 404 alike for what the operator does not reach), then the experiment —
// so it is named after the same condition and not after the fetch: reading the experiment store
// straight would skip the scope. Shared by every transition, so it is a service, not a use case
// (ADR-023).
import { ExperimentNotFound, type Experiment } from "../../../domain/experiment/index.js";
import {
  fail,
  ok,
  type ExperimentId,
  type MerchantId,
  type Result,
} from "../../../domain/shared-kernel/index.js";
import type { MerchantNotFound } from "../../../domain/merchant/index.js";
import type { MerchantOutOfScope, Operator } from "../../../domain/operator/index.js";
import type { ScopedMerchantService } from "../../merchant/index.js";
import type { ExperimentStore } from "../ports/experiment-store.js";

export type ScopedExperimentError = MerchantOutOfScope | MerchantNotFound | ExperimentNotFound;

export interface ScopedExperimentService {
  find(
    actor: Operator,
    merchantId: MerchantId,
    experimentId: ExperimentId,
  ): Promise<Result<Experiment, ScopedExperimentError>>;
}

export interface ScopedExperimentServiceDependencies {
  scoped: ScopedMerchantService;
  experiments: ExperimentStore;
}

export class DefaultScopedExperimentService implements ScopedExperimentService {
  readonly #deps: ScopedExperimentServiceDependencies;

  constructor(deps: ScopedExperimentServiceDependencies) {
    this.#deps = deps;
  }

  async find(
    actor: Operator,
    merchantId: MerchantId,
    experimentId: ExperimentId,
  ): Promise<Result<Experiment, ScopedExperimentError>> {
    const found = await this.#deps.scoped.find(actor, merchantId);
    if (!found.ok) return found;
    const experiment = await this.#deps.experiments.get(merchantId, experimentId);
    return experiment === undefined ? fail(new ExperimentNotFound()) : ok(experiment);
  }
}
