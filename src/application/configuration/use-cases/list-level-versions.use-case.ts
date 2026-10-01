// listPlatformConfigurationVersions and listTreatmentDefaultsVersions (feature 036, US4): the history of a
// level, newest first and paginated — what makes what is in force **explainable** instead of merely current.
//
// **One use case for the two levels**, with the level in the request, for the reason the publication is one:
// what differs between them is the vocabulary of the content, and a read does not judge it. The controller of
// each operation names its level and nothing else.
//
// **It does not take an operator's scope, and that is not an oversight.** A level is served to every
// merchant, so there is no merchant to check against; what the operation does take is the capability
// `configuration:read` of the admin consumer, which the edge compares before any of this runs (ADR-020).
import type { LevelVersion } from "../../../domain/configuration/index.js";
import type { ReleaseLevel } from "../../../domain/shared-kernel/index.js";
import type { Page, PageQuery, UseCase } from "../../shared-kernel/index.js";
import type { LevelStore } from "../ports/level-store.js";

export interface ListLevelVersionsRequest {
  level: ReleaseLevel;
  page: PageQuery;
}

/**
 * The listing as whoever serves it receives it (feature 036).
 *
 * It has a name because the two controllers of the two levels would otherwise repeat the same three type
 * imports to write it, and two controller files that share five identical lines are a clone — which the
 * duplication gate refuses and the shape rule cannot avoid, since an operation needs a file of its own.
 */
export type LevelHistoryReader = UseCase<ListLevelVersionsRequest, Page<LevelVersion>>;

export interface ListLevelVersionsDependencies {
  levels: LevelStore;
}

export class ListLevelVersionsUseCase implements UseCase<ListLevelVersionsRequest, Page<LevelVersion>> {
  readonly #deps: ListLevelVersionsDependencies;

  constructor(deps: ListLevelVersionsDependencies) {
    this.#deps = deps;
  }

  /** A listing cannot fail as a business outcome, so it answers the page directly (ADR-023). */
  execute(request: ListLevelVersionsRequest): Promise<Page<LevelVersion>> {
    return this.#deps.levels.versionsOf(request.level, request.page);
  }
}
