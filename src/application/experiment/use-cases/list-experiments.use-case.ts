// listExperiments (ADR-031): every experiment of the merchant, open or closed, newest first,
// paginated. Within the scope of the operator.
import { ok, type MerchantId, type Result } from "../../../domain/shared-kernel/index.js";
import type { Experiment } from "../../../domain/experiment/index.js";
import type { MerchantNotFound } from "../../../domain/merchant/index.js";
import type { MerchantOutOfScope, Operator } from "../../../domain/operator/index.js";
import type { ScopedMerchantService } from "../../merchant/index.js";
import type { Page, PageQuery, UseCase } from "../../shared-kernel/index.js";
import type { ExperimentStore } from "../ports/experiment-store.js";

export interface ListExperimentsRequest {
  actor: Operator;
  merchantId: MerchantId;
  page: PageQuery;
}

export type ListExperimentsResponse = Result<Page<Experiment>, MerchantOutOfScope | MerchantNotFound>;

export interface ListExperimentsDependencies {
  scoped: ScopedMerchantService;
  experiments: ExperimentStore;
}

export class ListExperimentsUseCase implements UseCase<ListExperimentsRequest, ListExperimentsResponse> {
  readonly #deps: ListExperimentsDependencies;

  constructor(deps: ListExperimentsDependencies) {
    this.#deps = deps;
  }

  async execute(request: ListExperimentsRequest): Promise<ListExperimentsResponse> {
    const found = await this.#deps.scoped.find(request.actor, request.merchantId);
    if (!found.ok) return found;
    return ok(await this.#deps.experiments.listOf(request.merchantId, request.page));
  }
}
