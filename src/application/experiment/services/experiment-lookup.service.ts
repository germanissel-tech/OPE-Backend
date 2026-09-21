// Application service: an experiment of a merchant within the scope of the operator — the scope
// and the existence of the merchant first (403 and 404 alike for what the operator does not
// reach), then the experiment. Shared by every transition, so it is a service, not a use case
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

export type ExperimentLookupError = MerchantOutOfScope | MerchantNotFound | ExperimentNotFound;

export interface ExperimentLookupService {
  find(
    actor: Operator,
    merchantId: MerchantId,
    experimentId: ExperimentId,
  ): Promise<Result<Experiment, ExperimentLookupError>>;
}

export interface ExperimentLookupServiceDependencies {
  scoped: ScopedMerchantService;
  experiments: ExperimentStore;
}

export class DefaultExperimentLookupService implements ExperimentLookupService {
  readonly #deps: ExperimentLookupServiceDependencies;

  constructor(deps: ExperimentLookupServiceDependencies) {
    this.#deps = deps;
  }

  async find(
    actor: Operator,
    merchantId: MerchantId,
    experimentId: ExperimentId,
  ): Promise<Result<Experiment, ExperimentLookupError>> {
    const found = await this.#deps.scoped.find(actor, merchantId);
    if (!found.ok) return found;
    const experiment = await this.#deps.experiments.get(merchantId, experimentId);
    return experiment === undefined ? fail(new ExperimentNotFound()) : ok(experiment);
  }
}
