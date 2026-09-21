// Experiment store port (ADR-031): the experiments of every merchant. Opening one judges the set
// of the merchant inside the store — at most one open, identifiers unique — in one step (01 §6),
// so two operators opening at once never both succeed; an update records a transition the entity
// already decided. Every write returns Result (ADR-021): StoreUnavailable, never a throw.
import type { Experiment, ExperimentSetError } from "../../../domain/experiment/index.js";
import type {
  ExperimentId,
  MerchantId,
  Result,
  StoreUnavailable,
} from "../../../domain/shared-kernel/index.js";
import type { Page, PageQuery } from "../../shared-kernel/index.js";

export interface ExperimentStore {
  /** Records a new experiment of its merchant if the set of the merchant admits it. */
  open(experiment: Experiment): Promise<Result<Experiment, ExperimentSetError | StoreUnavailable>>;
  /** Records the experiment as it is now (activated, closed, its window restarted). */
  update(experiment: Experiment): Promise<Result<Experiment, StoreUnavailable>>;
  get(merchantId: MerchantId, experimentId: ExperimentId): Promise<Experiment | undefined>;
  /** The experiments of the merchant, newest first. */
  listOf(merchantId: MerchantId, query: PageQuery): Promise<Page<Experiment>>;
}
