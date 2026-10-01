// Which experiments a change of a level reaches, and the restart of their measurement windows (feature 036,
// FR-007 and FR-008).
//
// **It exists because the question is one thing and the use case has six dependencies.** Answering it needs
// the merchants, what each of them declares, their active experiments and the store that records a restart —
// four interfaces for one question. As a service the use case asks it in **one** dependency and stays inside
// the limit of ADR-023, and the question gets a name instead of being four lines inside a publication.
//
// **Reached is decided leaf by leaf.** A merchant is out of reach only when it declares **every** leaf the
// change touches; declaring the object that contains them is not declaring them, because the resolution
// merges key by key. And only an **active** experiment counts: one in calibration has its decisions excluded
// from the analysis already, so there is nothing to protect.
import type { ChangedLeaves, LevelVersion } from "../../../domain/configuration/index.js";
import type { Experiment } from "../../../domain/experiment/index.js";
import type { Result, StoreUnavailable } from "../../../domain/shared-kernel/index.js";
import type { ExperimentDirectory, ExperimentStore } from "../../experiment/index.js";
import type { MerchantStore } from "../../merchant/index.js";
import type { ConfigurationStore } from "../ports/configuration-store.js";

/** What a publication of a level asks before deciding whether it may go through. */
export interface ReachedExperimentsService {
  /** The active experiments whose treatment the changed leaves reach, in no particular order. */
  by(changed: ChangedLeaves): Promise<readonly Experiment[]>;
  /** Restarts the window of each one, recording the version that caused it. */
  restart(
    experiments: readonly Experiment[],
    version: LevelVersion,
  ): Promise<Result<undefined, StoreUnavailable>>;
}

export interface ReachedExperimentsDependencies {
  merchants: MerchantStore;
  configurations: ConfigurationStore;
  experiments: ExperimentDirectory;
  experimentStore: ExperimentStore;
}

/** How many merchants are walked while looking for active experiments; D-21 keeps this a single process. */
const EVERY_MERCHANT_PAGE = 1000;

export class ReachedExperiments implements ReachedExperimentsService {
  readonly #deps: ReachedExperimentsDependencies;

  constructor(deps: ReachedExperimentsDependencies) {
    this.#deps = deps;
  }

  async by(changed: ChangedLeaves): Promise<readonly Experiment[]> {
    // Nothing changed reaches nobody, and saying so first keeps a repeated publication from walking anything.
    if (changed.none()) return [];
    const { merchants, configurations, experiments } = this.#deps;
    const page = await merchants.list({ limit: EVERY_MERCHANT_PAGE });
    const reached: Experiment[] = [];
    for (const merchant of page.items) {
      const open = await experiments.activeFor(merchant.merchantId);
      if (open?.isActive() !== true) continue;
      const declared = (await configurations.latestOf(merchant.merchantId))?.declared ?? {};
      if (!changed.coveredBy(declared)) reached.push(open);
    }
    return reached;
  }

  async restart(
    experiments: readonly Experiment[],
    version: LevelVersion,
  ): Promise<Result<undefined, StoreUnavailable>> {
    // **Nothing to restart demands nothing**, and asking the other way round was a defect: a publication
    // that reaches nobody needs no reason, and the guard below would have refused it.
    if (experiments.length === 0) return { ok: true, value: undefined };
    // With something to restart, the version is corrective and the draft guaranteed its reason: a version
    // that arrives here without one is a programming error, not a business outcome.
    if (version.reason === undefined) throw new Error("A corrective version carries a reason.");
    for (const experiment of experiments) {
      const restarted = experiment.windowRestarted(
        version.publishedAt,
        version.reason,
        version.version,
        version.level,
      );
      if (!restarted.ok) throw new Error("The window of an experiment that is not active cannot restart.");
      const updated = await this.#deps.experimentStore.update(restarted.value);
      if (!updated.ok) return updated;
    }
    return { ok: true, value: undefined };
  }
}
