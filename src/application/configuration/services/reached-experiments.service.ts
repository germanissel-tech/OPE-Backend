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
import { readOfLevel, type LevelVersionRead } from "./version-restarts.js";
import type { ChangedLeaves, LevelVersion } from "../../../domain/configuration/index.js";
import type { Experiment } from "../../../domain/experiment/index.js";
import type { Result, StoreUnavailable } from "../../../domain/shared-kernel/index.js";
import type { ActiveExperimentsService, WindowRestartsService } from "../../experiment/index.js";
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
  /** The version with what it restarted when it was published (feature 042). */
  restartedBy(version: LevelVersion): Promise<LevelVersionRead>;
}

export interface ReachedExperimentsDependencies {
  configurations: ConfigurationStore;
  /** The active experiment of every merchant: the walk is the experiment module's since feature 038. */
  active: ActiveExperimentsService;
  /** The restart itself, which is the experiment module's since feature 038: the texts restart the same way. */
  restarts: WindowRestartsService;
}

export class ReachedExperiments implements ReachedExperimentsService {
  readonly #deps: ReachedExperimentsDependencies;

  constructor(deps: ReachedExperimentsDependencies) {
    this.#deps = deps;
  }

  async by(changed: ChangedLeaves): Promise<readonly Experiment[]> {
    // Nothing changed reaches nobody, and saying so first keeps a repeated publication from walking anything.
    if (changed.none()) return [];
    const { configurations, active } = this.#deps;
    const reached: Experiment[] = [];
    for (const open of await active.everywhere()) {
      const declared = (await configurations.latestOf(open.merchantId))?.declared ?? {};
      if (!changed.coveredBy(declared)) reached.push(open);
    }
    return reached;
  }

  restartedBy(version: LevelVersion): Promise<LevelVersionRead> {
    return readOfLevel(this.#deps.restarts, version);
  }

  restart(
    experiments: readonly Experiment[],
    version: LevelVersion,
  ): Promise<Result<undefined, StoreUnavailable>> {
    return this.#deps.restarts.restart(experiments, {
      at: version.publishedAt,
      reason: version.reason,
      level: version.level,
      version: version.version,
    });
  }
}
