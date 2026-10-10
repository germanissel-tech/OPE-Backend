// The restart of the measurement windows a publication of treatment reaches (feature 038; the mechanism of
// feature 036, extracted). It lives here because it is the experiment's entity that restarts, and because
// two modules that cannot depend on each other publish treatment —the configuration levels and the texts—
// and each has to restart the same way. Copied, the rule of «a corrective version carries its reason» and
// the write of each experiment would have been two things to keep in step.
import type { Experiment, RestartSource, TextRestartCause } from "../../../domain/experiment/index.js";
import type {
  ConfigurationLevel,
  MerchantId,
  Result,
  StoreUnavailable,
} from "../../../domain/shared-kernel/index.js";
import type { ExperimentStore } from "../ports/experiment-store.js";

/** What caused the restart: a version of a level, or a version of a text in a layer. */
export interface RestartCause {
  at: Date;
  /** Absent only when nothing is reached: with something to restart, the version is corrective and carries it. */
  reason?: string | undefined;
  level: ConfigurationLevel;
  version: number;
  text?: TextRestartCause | undefined;
}

export interface WindowRestartsService {
  /** Restarts the window of each experiment, recording the cause; nothing to restart demands nothing. */
  restart(
    experiments: readonly Experiment[],
    cause: RestartCause,
  ): Promise<Result<undefined, StoreUnavailable>>;
  /**
   * The experiments whose window that version restarted (feature 042), in the order of the store. With a
   * merchant, only that merchant's: a merchant numbers its own versions, so «merchant, version 1» is one
   * version per merchant, and only the merchant tells them apart.
   */
  restartedBy(source: RestartSource, merchantId?: MerchantId): Promise<readonly Experiment[]>;
}

export interface WindowRestartsDependencies {
  experimentStore: ExperimentStore;
}

export class WindowRestarts implements WindowRestartsService {
  readonly #deps: WindowRestartsDependencies;

  constructor(deps: WindowRestartsDependencies) {
    this.#deps = deps;
  }

  async restart(
    experiments: readonly Experiment[],
    cause: RestartCause,
  ): Promise<Result<undefined, StoreUnavailable>> {
    // **Nothing to restart demands nothing**, and asking the other way round was a defect: a publication
    // that reaches nobody needs no reason, and the guard below would have refused it.
    if (experiments.length === 0) return { ok: true, value: undefined };
    // With something to restart, the version is corrective and the draft guaranteed its reason: a version
    // that arrives here without one is a programming error, not a business outcome.
    if (cause.reason === undefined) throw new Error("A corrective version carries a reason.");
    for (const experiment of experiments) {
      const restarted = experiment.windowRestarted(cause.at, cause.reason, {
        level: cause.level,
        configurationVersion: cause.version,
        text: cause.text,
      });
      if (!restarted.ok) throw new Error("The window of an experiment that is not active cannot restart.");
      const updated = await this.#deps.experimentStore.update(restarted.value);
      if (!updated.ok) return updated;
    }
    return { ok: true, value: undefined };
  }

  async restartedBy(source: RestartSource, merchantId?: MerchantId): Promise<readonly Experiment[]> {
    const every = await this.#deps.experimentStore.all();
    return every.filter(
      (experiment) =>
        (merchantId === undefined || experiment.merchantId === merchantId) && experiment.restartedBy(source),
    );
  }
}
