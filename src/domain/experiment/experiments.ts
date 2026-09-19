// The experiments of a merchant (ADR-022, ADR-024): a set with rules of its own — at most one
// active, identifiers unique — so that no parser has to know them. `of` judges a set of
// experiments each already built by its own factory; `rehydrate` trusts a recorded set.
import { fail, ok, type ExperimentId, type Result } from "../shared-kernel/index.js";
import { DuplicateExperimentId, MultipleActiveExperiments, type ExperimentError } from "./errors.js";
import type { Experiment } from "./experiment.js";

export class Experiments {
  readonly #experiments: readonly Experiment[];

  private constructor(experiments: readonly Experiment[]) {
    this.#experiments = [...experiments];
  }

  /** The set of these experiments, or the first violated rule naming the offending index. */
  static of(experiments: readonly Experiment[]): Result<Experiments, ExperimentError> {
    const ids = new Set<ExperimentId>();
    let active: Experiment | undefined;
    for (const [index, experiment] of experiments.entries()) {
      if (ids.has(experiment.experimentId)) return fail(new DuplicateExperimentId(index));
      ids.add(experiment.experimentId);
      if (!experiment.isActive()) continue;
      if (active !== undefined) return fail(new MultipleActiveExperiments(index));
      active = experiment;
    }
    return ok(new Experiments(experiments));
  }

  /** A set a store recorded: its rules are not re-judged. */
  static rehydrate(experiments: readonly Experiment[]): Experiments {
    return new Experiments(experiments);
  }

  /** The active experiment, if any (at most one by construction). */
  active(): Experiment | undefined {
    return this.#experiments.find((e) => e.isActive());
  }

  all(): readonly Experiment[] {
    return this.#experiments;
  }
}
