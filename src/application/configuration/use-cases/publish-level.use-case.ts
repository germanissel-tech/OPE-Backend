// publishPlatformConfiguration and publishTreatmentDefaults (feature 036; constitution XI; ADR-031 as
// amended): the next version of a level of the release, published by an operator instead of deployed.
//
// **One use case for the two levels**, with the level in the request. They hold different values and share
// everything that happens when one is published —the authority it takes, the repetition of an identical
// body, the freeze, the restarted windows, the numbering— and what the content means is the business of the
// reader of each level, which `judgeLevel` picks. Two classes would have been the same forty lines twice
// with a string changed, which is what the duplication gate is for.
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
import {
  fail,
  ok,
  type LocaleIncomplete,
  StaleVersion,
  type ReleaseLevel,
  type Result,
  type StoreUnavailable,
} from "../../../domain/shared-kernel/index.js";
import { publishedBy } from "../services/publication.js";
import type { Operator, OperatorScopeTooNarrow } from "../../../domain/operator/index.js";
import type { Clock, UseCase } from "../../shared-kernel/index.js";
import type { LevelStore } from "../ports/level-store.js";
import type { ConfigurationService } from "../services/configuration.service.js";
import type { ReachedExperimentsService } from "../services/reached-experiments.service.js";
import type { LevelVersionRead } from "../services/version-restarts.js";

export interface PublishLevelRequest {
  actor: Operator;
  /** Which of the two levels of the release is being published; the controller names it, not the body. */
  level: ReleaseLevel;
  content: Record<string, unknown>;
  corrective: boolean;
  /**
   * Why the version is published, when the operator declared one.
   *
   * `?: string | undefined` and not `?: string`: the controller hands over what the body carries, absent or
   * not, and the single guard that turns the second into the first lives in `publishedBy`. Writing that
   * guard twice produced a branch whose two arms are the same input, which no test can tell apart.
   */
  reason?: string | undefined;
  /**
   * The witness of the level as the caller read it (feature 043, ADR-046): the name of the version that was in
   * force. The publication replaces the whole level with what the caller read and changed, so it is accepted
   * only if that version is still the one in force.
   */
  witness: string;
}

/**
 * The version with what it restarted, and whether this request created it. A repetition answers what the
 * version restarted when it was published (feature 042): the same as any reading of it.
 */
export interface PublishedLevel extends LevelVersionRead {
  outcome: "created" | "repeated";
}

/** `LocaleIncomplete` is the word of the decorator in front of the defaults (feature 038, US4), never of this use case's deed. */
export type PublishLevelResponse = Result<
  PublishedLevel,
  | OperatorScopeTooNarrow
  | ConfigurationReasonRequired
  | ConfigurationFrozen
  | InvalidConfigurationValue
  | LocaleIncomplete
  | StaleVersion
  | StoreUnavailable
>;

export interface PublishLevelDependencies {
  levels: LevelStore;
  configuration: ConfigurationService;
  reached: ReachedExperimentsService;
  clock: Clock;
}

export class PublishLevelUseCase implements UseCase<PublishLevelRequest, PublishLevelResponse> {
  readonly #deps: PublishLevelDependencies;

  constructor(deps: PublishLevelDependencies) {
    this.#deps = deps;
  }

  async execute(request: PublishLevelRequest): Promise<PublishLevelResponse> {
    const { levels, configuration, reached, clock } = this.#deps;
    const covers = request.actor.coversEveryMerchant();
    if (!covers.ok) return fail(covers.error);
    const draft = LevelVersion.draft({
      level: request.level,
      content: request.content,
      ...publishedBy(request, clock),
    });
    if (!draft.ok) return fail(draft.error);
    const inForce = await levels.latestOf(request.level);
    if (inForce?.sameContentAs(draft.value) === true) {
      return ok({ ...(await reached.restartedBy(inForce)), outcome: "repeated" });
    }
    // **After the repetition and before anything else** (ADR-046): an identical body overwrites nothing, so
    // the retry of a publication that went through answers as before whatever witness it carries; and a
    // stale witness is refused before the freeze, because explaining the 409 of what changed is no help.
    // The publication runs inside the unit of work of the audit, which takes its turn: nothing can be
    // published between this comparison and the write (feature 034).
    // A level with no version yet has nothing to overwrite, so there is no witness to keep.
    if (inForce !== undefined && inForce.versionName() !== request.witness) return fail(new StaleVersion());
    // Judged before anything is written: a value the vocabulary refuses never becomes a version (FR-005).
    const judged = await configuration.judgeLevel(draft.value);
    if (!judged.ok) return fail(judged.error);
    const toRestart = inForce === undefined ? [] : await reached.by(inForce.measuringLeaves(draft.value));
    if (toRestart.length > 0 && !request.corrective) return fail(new ConfigurationFrozen());
    const published = await levels.publish(draft.value);
    if (!published.ok) return fail(published.error);
    // **Forgetting is enough, and recomputing every merchant would be work for nothing.** The resolution of
    // each merchant is lazy, so the next request of each one pays one read — which is exactly what a cold
    // boot already costs and what SC-006 measures. What `refresh` does read is the two levels, because the
    // consumers of level 1 ask for it synchronously and must never find it missing.
    //
    // **And it happens before the windows are restarted**, which is the order that matters: from here on
    // every request is served the version just published, so a window that restarts does it over the
    // treatment that is actually in force.
    await configuration.refresh();
    const restarted = await reached.restart(toRestart, published.value);
    if (!restarted.ok) return fail(restarted.error);
    return ok({ version: published.value, outcome: "created", windowsRestarted: toRestart });
  }
}
