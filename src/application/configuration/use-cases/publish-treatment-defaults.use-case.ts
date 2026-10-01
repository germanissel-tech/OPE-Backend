// publishTreatmentDefaults (feature 036; constitution XI; ADR-031 as amended): the next version of level 2,
// published by an operator instead of deployed.
//
// It is the use case of a merchant's configuration one level up, and the two differences are the whole
// subject of the feature:
//
//   - **The scope is every merchant, so it takes an operator over every merchant.** There is no merchant to
//     check against here: a level reaches whoever does not override it, and an operator scoped to a list
//     cannot change what the others are served.
//   - **The freeze is multitenant.** A merchant's version freezes on that merchant's active experiment; this
//     one freezes on **every experiment the change reaches** — the ones whose merchant does not declare all
//     the leaves that changed (FR-007) — and a corrective version restarts every one of those windows. That
//     whole question lives in `ReachedExperiments`, which is why this use case asks it in one dependency and
//     stays inside the six of ADR-023.
import {
  ConfigurationFrozen,
  LevelVersion,
  type ConfigurationReasonRequired,
  type InvalidConfigurationValue,
} from "../../../domain/configuration/index.js";
import { fail, ok, type Result, type StoreUnavailable } from "../../../domain/shared-kernel/index.js";
import { publishedBy } from "../services/publication.js";
import type { Experiment } from "../../../domain/experiment/index.js";
import type { Operator, OperatorScopeTooNarrow } from "../../../domain/operator/index.js";
import type { Clock, UseCase } from "../../shared-kernel/index.js";
import type { LevelStore } from "../ports/level-store.js";
import type { ConfigurationService } from "../services/configuration.service.js";
import type { ReachedExperimentsService } from "../services/reached-experiments.service.js";

export interface PublishTreatmentDefaultsRequest {
  actor: Operator;
  content: Record<string, unknown>;
  corrective: boolean;
  reason?: string;
}

export interface PublishedLevel {
  version: LevelVersion;
  outcome: "created" | "repeated";
  /** The experiments whose measurement window this version restarted; empty unless it was corrective. */
  windowsRestarted: readonly Experiment[];
}

export type PublishTreatmentDefaultsResponse = Result<
  PublishedLevel,
  | OperatorScopeTooNarrow
  | ConfigurationReasonRequired
  | ConfigurationFrozen
  | InvalidConfigurationValue
  | StoreUnavailable
>;

export interface PublishTreatmentDefaultsDependencies {
  levels: LevelStore;
  configuration: ConfigurationService;
  reached: ReachedExperimentsService;
  clock: Clock;
}

export class PublishTreatmentDefaultsUseCase implements UseCase<
  PublishTreatmentDefaultsRequest,
  PublishTreatmentDefaultsResponse
> {
  readonly #deps: PublishTreatmentDefaultsDependencies;

  constructor(deps: PublishTreatmentDefaultsDependencies) {
    this.#deps = deps;
  }

  async execute(request: PublishTreatmentDefaultsRequest): Promise<PublishTreatmentDefaultsResponse> {
    const { levels, configuration, reached, clock } = this.#deps;
    const covers = request.actor.coversEveryMerchant();
    if (!covers.ok) return fail(covers.error);
    const draft = LevelVersion.draft({
      level: "defaults",
      content: request.content,
      ...publishedBy(request, clock),
    });
    if (!draft.ok) return fail(draft.error);
    const inForce = await levels.latestOf("defaults");
    if (inForce?.sameContentAs(draft.value) === true) {
      return ok({ version: inForce, outcome: "repeated", windowsRestarted: [] });
    }
    // Judged before anything is written: a value the vocabulary refuses never becomes a version (FR-005).
    const judged = await configuration.judgeLevel(draft.value);
    if (!judged.ok) return fail(judged.error);
    const toRestart = inForce === undefined ? [] : await reached.by(inForce.changedLeaves(draft.value));
    if (toRestart.length > 0 && !request.corrective) return fail(new ConfigurationFrozen());
    const published = await levels.publish(draft.value);
    if (!published.ok) return fail(published.error);
    // **Invalidating is enough, and recomputing would be work for nothing.** The resolution of each merchant
    // is lazy, so the next request of each one pays one read — which is exactly what a cold boot already
    // costs and what SC-006 measures.
    configuration.invalidate();
    const restarted = await reached.restart(toRestart, published.value);
    if (!restarted.ok) return fail(restarted.error);
    return ok({ version: published.value, outcome: "created", windowsRestarted: toRestart });
  }
}
