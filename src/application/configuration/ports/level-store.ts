// Level store port (feature 036; ADR-031 as amended): the versions an operator published of the two levels
// of the release, numbered by the store itself — the next number **of that level** is assigned and the
// version recorded in one step, so two operators publishing at once never share a number. Nothing is ever
// overwritten. Every write returns `Result` (ADR-021): `StoreUnavailable`, never a throw.
//
// **One port for the two levels**, with the level as part of the question. They have different vocabularies
// but the same life —numbered, immutable, one in force— and two ports would be the same code twice with a
// different name.
import type { LevelDraft, LevelVersion } from "../../../domain/configuration/index.js";
import type { ReleaseLevel, Result, StoreUnavailable } from "../../../domain/shared-kernel/index.js";
import type { Page, PageQuery } from "../../shared-kernel/index.js";

export interface LevelStore {
  /** Records the draft as the next version of its level and answers it numbered. */
  publish(draft: LevelDraft): Promise<Result<LevelVersion, StoreUnavailable>>;
  /** The version in force of a level, or undefined when the level holds none — an empty store. */
  latestOf(level: ReleaseLevel): Promise<LevelVersion | undefined>;
  /** The versions of a level, newest first. */
  versionsOf(level: ReleaseLevel, query: PageQuery): Promise<Page<LevelVersion>>;
  /** One version of a level, as it was published, or undefined when there is no such number. */
  versionOf(level: ReleaseLevel, version: number): Promise<LevelVersion | undefined>;
}
