// The active experiments of every merchant (feature 038; the walk of feature 036, extracted). A change
// of treatment that reaches many merchants —a level, a base text— asks which running measurements it
// touches, and the two modules that publish treatment cannot depend on each other: the walk lives with
// the experiments, and each caller keeps only its predicate of «out of reach».
import type { Experiment } from "../../../domain/experiment/index.js";
import type { MerchantStore } from "../../merchant/index.js";
import type { ExperimentDirectory } from "../ports/experiment-directory.js";

export interface ActiveExperimentsService {
  /** The active experiment of every merchant that has one, in no particular order. */
  everywhere(): Promise<readonly Experiment[]>;
}

export interface ActiveExperimentsDependencies {
  merchants: MerchantStore;
  experiments: ExperimentDirectory;
}

/** How many merchants are walked while looking for active experiments; D-21 keeps this a single process. */
const EVERY_MERCHANT_PAGE = 1000;

export class ActiveExperiments implements ActiveExperimentsService {
  readonly #deps: ActiveExperimentsDependencies;

  constructor(deps: ActiveExperimentsDependencies) {
    this.#deps = deps;
  }

  async everywhere(): Promise<readonly Experiment[]> {
    const { merchants, experiments } = this.#deps;
    const page = await merchants.list({ limit: EVERY_MERCHANT_PAGE });
    const active: Experiment[] = [];
    for (const merchant of page.items) {
      const open = await experiments.activeFor(merchant.merchantId);
      if (open?.isActive() === true) active.push(open);
    }
    return active;
  }
}
