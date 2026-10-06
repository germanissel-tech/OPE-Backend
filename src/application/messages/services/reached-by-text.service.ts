// Which experiments a publication of a text reaches, and the restart of their windows (feature 038,
// FR-013 to FR-015). It is the question of the levels (feature 036) with another source of «out of reach»:
// there, a merchant is out when it declares every leaf that changed; here, when it has its own text in
// force for the key and the language. A merchant's text reaches only the merchant's experiments, and the
// question is not even asked. As a service, the use case asks it in one dependency (ADR-023).
import type { Experiment } from "../../../domain/experiment/index.js";
import type { TextKeyRecord, TextVersion } from "../../../domain/messages/index.js";
import type { Result, StoreUnavailable } from "../../../domain/shared-kernel/index.js";
import type {
  ActiveExperimentsService,
  ExperimentDirectory,
  WindowRestartsService,
} from "../../experiment/index.js";
import type { TextLayer, TextStore } from "../ports/text-store.js";

export interface ReachedByTextService {
  /** The active experiments a text of that key in that layer reaches, in no particular order. */
  by(layer: TextLayer, key: TextKeyRecord): Promise<readonly Experiment[]>;
  /** Restarts the window of each one, recording the text that caused it. */
  restart(
    experiments: readonly Experiment[],
    version: TextVersion,
  ): Promise<Result<undefined, StoreUnavailable>>;
}

export interface ReachedByTextDependencies {
  /** The active experiment of every merchant, for a base text; the directory, for a merchant's own. */
  active: ActiveExperimentsService;
  experiments: ExperimentDirectory;
  texts: TextStore;
  restarts: WindowRestartsService;
}

export class ReachedByText implements ReachedByTextService {
  readonly #deps: ReachedByTextDependencies;

  constructor(deps: ReachedByTextDependencies) {
    this.#deps = deps;
  }

  async by(layer: TextLayer, key: TextKeyRecord): Promise<readonly Experiment[]> {
    const { active, experiments, texts } = this.#deps;
    if (layer !== undefined) {
      const own = await experiments.activeFor(layer);
      return own?.isActive() === true ? [own] : [];
    }
    const reached: Experiment[] = [];
    for (const open of await active.everywhere()) {
      // A merchant with its own text in force for the key is out of reach: the base is not what it shows.
      const own = await texts.inForce(open.merchantId, key);
      if (own !== undefined && !own.isRemoved()) continue;
      reached.push(open);
    }
    return reached;
  }

  restart(
    experiments: readonly Experiment[],
    version: TextVersion,
  ): Promise<Result<undefined, StoreUnavailable>> {
    return this.#deps.restarts.restart(experiments, {
      at: version.publishedAt,
      reason: version.reason,
      // The level is what a reader of the restart knew before texts could cause one (feature 036): a text of
      // a merchant stands where a merchant's version did, a base text where the defaults did.
      level: version.merchantId === undefined ? "defaults" : "merchant",
      version: version.version,
      text: { ...version.key.record(), layer: version.layer() },
    });
  }
}
