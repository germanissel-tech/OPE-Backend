// importConfigurationLevels (feature 036): the two levels the release file declares become version 1 of
// each level, as the system operator, **only when that level holds none** — like the merchants and their
// configuration, the seed enters an empty store and never overwrites.
//
// It is what turns the files from the source into the seed. From the second boot on, what is in force is
// what an operator published, and editing the file does nothing — which is the half of **D-29** this closes:
// the boot says what it did instead of reporting an import that did not happen.
//
// **The declared `version` of the file is dropped**, because from here on the name of a version is minted
// from its number (`platform-1`, `defaults-1`). Before the first pilot that is free; it is stated in the
// amendment of ADR-031 because after one it would not be — a decision already stamped with a name is a
// decision whose treatment has to keep that name.
import {
  LevelVersion,
  type ConfigurationLevel,
  type ConfigurationReasonRequired,
} from "../../../domain/configuration/index.js";
import { fail, ok, type Result, type StoreUnavailable } from "../../../domain/shared-kernel/index.js";
import type { Operator } from "../../../domain/operator/index.js";
import type { Clock, UseCase } from "../../shared-kernel/index.js";
import type { LevelStore } from "../ports/level-store.js";

export interface ImportConfigurationLevelsRequest {
  actor: Operator;
  /** What the release files declare, level by level, with their own `version` still in it. */
  contents: readonly { level: ConfigurationLevel; content: Record<string, unknown> }[];
}

export type ImportConfigurationLevelsResponse = Result<
  { imported: readonly ConfigurationLevel[] },
  ConfigurationReasonRequired | StoreUnavailable
>;

export interface ImportConfigurationLevelsDependencies {
  levels: LevelStore;
  clock: Clock;
}

export class ImportConfigurationLevelsUseCase implements UseCase<
  ImportConfigurationLevelsRequest,
  ImportConfigurationLevelsResponse
> {
  readonly #deps: ImportConfigurationLevelsDependencies;

  constructor(deps: ImportConfigurationLevelsDependencies) {
    this.#deps = deps;
  }

  async execute(request: ImportConfigurationLevelsRequest): Promise<ImportConfigurationLevelsResponse> {
    const { levels, clock } = this.#deps;
    const imported: ConfigurationLevel[] = [];
    for (const { level, content } of request.contents) {
      if ((await levels.latestOf(level)) !== undefined) continue;
      const draft = LevelVersion.draft({
        level,
        // Without the `version` the file declares: from here on the name comes from the number.
        content: Object.fromEntries(Object.entries(content).filter(([key]) => key !== VERSION)),
        corrective: false,
        publishedAt: clock.now(),
        operatorId: request.actor.operatorId,
      });
      if (!draft.ok) return fail(draft.error);
      const published = await levels.publish(draft.value);
      if (!published.ok) return fail(published.error);
      imported.push(level);
    }
    return ok({ imported });
  }
}

/** The key the release files carry and the store does not: the name is minted from the number. */
const VERSION = "version";
