// getPlatformConfigurationVersion and getTreatmentDefaultsVersion (feature 036, US4): one version of a
// level, by its number, as it was published.
//
// A version is immutable, so what this answers today is what it answered the day it was created: it is the
// treatment the decisions that stamped that name were taken under, which is the half an analysis needs when
// it asks why two stretches of the same experiment do not agree.
import { ConfigurationVersionNotFound, type LevelVersion } from "../../../domain/configuration/index.js";
import { fail, ok, type ReleaseLevel, type Result } from "../../../domain/shared-kernel/index.js";
import type { UseCase } from "../../shared-kernel/index.js";
import type { LevelStore } from "../ports/level-store.js";

export interface GetLevelVersionRequest {
  level: ReleaseLevel;
  version: number;
}

export type GetLevelVersionResponse = Result<LevelVersion, ConfigurationVersionNotFound>;

export interface GetLevelVersionDependencies {
  levels: LevelStore;
}

export class GetLevelVersionUseCase implements UseCase<GetLevelVersionRequest, GetLevelVersionResponse> {
  readonly #deps: GetLevelVersionDependencies;

  constructor(deps: GetLevelVersionDependencies) {
    this.#deps = deps;
  }

  async execute(request: GetLevelVersionRequest): Promise<GetLevelVersionResponse> {
    const found = await this.#deps.levels.versionOf(request.level, request.version);
    // A number nobody published is a `404` and not an empty answer: nothing is ever deleted from a level's
    // history, so a missing number means it never existed.
    if (found === undefined) return fail(new ConfigurationVersionNotFound(request.level, request.version));
    return ok(found);
  }
}
