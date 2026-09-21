// importExperiments (ADR-031): the experiments the seed declares for a merchant enter the store
// through the same door as the API — entities the configuration already built, the set judged by
// the store — as the system operator, only when the merchant has none recorded: the seed is a
// start, not a source of truth. The seed is the origin, so the holdout does not judge it.
import {
  fail,
  ok,
  type MerchantId,
  type Result,
  type StoreUnavailable,
} from "../../../domain/shared-kernel/index.js";
import type { Experiment, ExperimentSetError } from "../../../domain/experiment/index.js";
import type { Operator } from "../../../domain/operator/index.js";
import type { UseCase } from "../../shared-kernel/index.js";
import type { ExperimentStore } from "../ports/experiment-store.js";

export interface ImportExperimentsRequest {
  actor: Operator;
  merchantId: MerchantId;
  experiments: readonly Experiment[];
}

export type ImportExperimentsResponse = Result<
  { imported: number } | { skipped: true },
  ExperimentSetError | StoreUnavailable
>;

export interface ImportExperimentsDependencies {
  experiments: ExperimentStore;
}

/** The first page tells whether the merchant has any experiment recorded. */
const ANY = { limit: 1 };

export class ImportExperimentsUseCase implements UseCase<
  ImportExperimentsRequest,
  ImportExperimentsResponse
> {
  readonly #deps: ImportExperimentsDependencies;

  constructor(deps: ImportExperimentsDependencies) {
    this.#deps = deps;
  }

  async execute(request: ImportExperimentsRequest): Promise<ImportExperimentsResponse> {
    const { experiments } = this.#deps;
    const recorded = await experiments.listOf(request.merchantId, ANY);
    if (recorded.items.length > 0) return ok({ skipped: true });
    for (const experiment of request.experiments) {
      const opened = await experiments.open(experiment);
      if (!opened.ok) return fail(opened.error);
    }
    return ok({ imported: request.experiments.length });
  }
}
