import { fail, ok, type ExperimentId, type Result } from "../shared-kernel/index.js";
import { DuplicateExperimentId, ExperimentAlreadyOpen, type ExperimentSetError } from "./errors.js";
import type { Experiment } from "./experiment.js";

export class Experiments {
  readonly #experiments: readonly Experiment[];

  private constructor(experiments: readonly Experiment[]) {
    this.#experiments = [...experiments];
  }

  /** The set of these experiments, or the first violated rule naming the offending index. */
  static of(experiments: readonly Experiment[]): Result<Experiments, ExperimentSetError> {
    const ids = new Set<ExperimentId>();
    let open: Experiment | undefined;
    for (const [index, experiment] of experiments.entries()) {
      if (ids.has(experiment.experimentId)) return fail(new DuplicateExperimentId(index));
      ids.add(experiment.experimentId);
      if (!experiment.isOpen()) continue;
      if (open !== undefined) return fail(new ExperimentAlreadyOpen(index));
      open = experiment;
    }
    return ok(new Experiments(experiments));
  }

  /** A set a store recorded: its rules are not re-judged. */
  static rehydrate(experiments: readonly Experiment[]): Experiments {
    return new Experiments(experiments);
  }

  /** The open experiment — calibrating or active — if any (at most one by construction). */
  open(): Experiment | undefined {
    return this.#experiments.find((e) => e.isOpen());
  }

  all(): readonly Experiment[] {
    return this.#experiments;
  }
}
