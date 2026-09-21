// In-memory experiment store (ADR-031): the experiments of every merchant, and the directory the
// assignment reads from the same instance — an experiment opened, activated or closed by the
// administration counts on the next batch. Opening judges the set of the merchant (at most one
// open, identifiers unique) and records in one step, without an await in between (01 §6).
// Nothing crosses merchants; nothing is deleted.
import { Experiments, type Experiment } from "../../../domain/experiment/index.js";
import { fail, ok, type ExperimentId, type MerchantId } from "../../../domain/shared-kernel/index.js";
import { pageOf } from "../shared-kernel/paging.js";
import type { ExperimentDirectory, ExperimentStore } from "../../../application/experiment/index.js";

export function memoryExperimentStore(): ExperimentStore & ExperimentDirectory {
  const byMerchant = new Map<MerchantId, Experiment[]>();
  const of = (merchantId: MerchantId): Experiment[] => byMerchant.get(merchantId) ?? [];
  const set = (merchantId: MerchantId): Experiments => Experiments.rehydrate(of(merchantId));
  const find = (merchantId: MerchantId, experimentId: ExperimentId): Experiment | undefined =>
    of(merchantId).find((e) => e.experimentId === experimentId);
  return {
    open(experiment) {
      const current = of(experiment.merchantId);
      const judged = Experiments.of([...current, experiment]);
      if (!judged.ok) return Promise.resolve(fail(judged.error));
      byMerchant.set(experiment.merchantId, [...judged.value.all()]);
      return Promise.resolve(ok(experiment));
    },
    update(experiment) {
      // Only a recorded experiment reaches here (the use case read it first): an unknown one is a programming error.
      if (find(experiment.merchantId, experiment.experimentId) === undefined) {
        return Promise.reject(new Error(`The experiment ${experiment.experimentId} was never opened.`));
      }
      const replaced = of(experiment.merchantId).map((e) =>
        e.experimentId === experiment.experimentId ? experiment : e,
      );
      byMerchant.set(experiment.merchantId, replaced);
      return Promise.resolve(ok(experiment));
    },
    get(merchantId, experimentId) {
      return Promise.resolve(find(merchantId, experimentId));
    },
    listOf(merchantId, query) {
      return Promise.resolve(pageOf([...of(merchantId)].reverse(), query));
    },
    activeFor(merchantId) {
      return Promise.resolve(set(merchantId).open());
    },
  };
}
