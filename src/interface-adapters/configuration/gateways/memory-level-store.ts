// In-memory level store (feature 036): the versions of each level, numbered as they are published — the
// number is the size of the list of **that level** plus one, assigned and written without an await in
// between (01 §6). Nothing is overwritten, and the two levels never share a number because they never share
// a list.
import { LevelVersion } from "../../../domain/configuration/index.js";
import { ok, type ReleaseLevel } from "../../../domain/shared-kernel/index.js";
import { pageOf } from "../../shared-kernel/index.js";
import type { LevelStore } from "../../../application/configuration/index.js";

export function memoryLevelStore(): LevelStore {
  const byLevel = new Map<ReleaseLevel, LevelVersion[]>();
  const versions = (level: ReleaseLevel): LevelVersion[] => byLevel.get(level) ?? [];
  return {
    publish(draft) {
      const published = versions(draft.level);
      const numbered = LevelVersion.numbered(draft, published.length + 1);
      byLevel.set(draft.level, [...published, numbered]);
      return Promise.resolve(ok(numbered));
    },
    latestOf(level) {
      return Promise.resolve(versions(level).at(-1));
    },
    versionsOf(level, query) {
      return Promise.resolve(pageOf([...versions(level)].reverse(), query));
    },
    versionOf(level, version) {
      return Promise.resolve(versions(level).find((published) => published.version === version));
    },
  };
}
