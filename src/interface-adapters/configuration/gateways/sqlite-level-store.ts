// The two levels of the release on the durable store (feature 036): one row per published version of each
// level, never overwritten, never deleted.
//
// It is the gateway of the merchant versions with the level in place of the merchant, and for the same
// reasons: the version in force is the **highest number** and no column says so — a `current` flag would be
// a second place stating what the number already states, and two places can disagree.
//
// **Where the next number comes from is the whole design.** `MAX(version) + 1` **of that level**, read and
// written inside one transaction, which is the step `01 §6` asks for: nothing asynchronous happens between
// deciding the number and taking it. The unique index on `(level, version)` turns a lost race into a refused
// write instead of a silent overwrite, and it is also what would catch a gateway keeping a counter of its
// own — a counter that starts at zero on the next boot and renumbers a history meant to be immutable.
//
// Reads are cold on purpose: the service holds the level in force in memory and asks again only when
// something is published, so a change of level costs one read of each level and one per merchant, which is
// what a cold boot already costs (research R-03).
import { LevelVersion, type LevelVersionRecord } from "../../../domain/configuration/index.js";
import {
  descending,
  fetched,
  fromDocument,
  pageTo,
  stored,
  toDocument,
  type DurableGatewayDeps,
  type SqlRow,
} from "../../shared-kernel/index.js";
import type { LevelStore } from "../../../application/configuration/index.js";

/** The column every table of this schema keeps the record in. */
const DOCUMENT = "document";
/** What a refused write is reported as. */
const WRITE = "configuration-level";

/** The number this level's next version takes. A level with no versions starts at one. */
const NEXT_VERSION = `SELECT COALESCE(MAX(version), 0) + 1 AS next
  FROM configuration_levels WHERE level = :level`;

const INSERT = `INSERT INTO configuration_levels (level, version, document)
  VALUES (:level, :version, :document)`;

const LATEST = `SELECT document FROM configuration_levels
  WHERE level = :level ORDER BY version DESC LIMIT 1`;

/** Newest first, resuming below the version the cursor names: the key does not move when one is added. */
const VERSIONS = `SELECT version, document FROM configuration_levels
  WHERE level = :level AND version < :below
  ORDER BY version DESC LIMIT :limit`;

const ONE = `SELECT document FROM configuration_levels WHERE level = :level AND version = :version`;

const versionOf = (row: SqlRow): LevelVersion =>
  LevelVersion.rehydrate(fromDocument(String(row[DOCUMENT])) as LevelVersionRecord);

export function sqliteLevelStore(deps: DurableGatewayDeps): LevelStore {
  return {
    publish: (draft) =>
      stored(deps, WRITE, () =>
        deps.store.transaction(() => {
          const next = Number(deps.store.all(NEXT_VERSION, { level: draft.level })[0]?.["next"]);
          const numbered = LevelVersion.numbered(draft, next);
          deps.store.run(INSERT, {
            level: draft.level,
            version: next,
            document: toDocument(numbered.record()),
          });
          return numbered;
        }),
      ),
    latestOf: (level) =>
      fetched(deps, () => {
        const row = deps.store.all(LATEST, { level })[0];
        return row === undefined ? undefined : versionOf(row);
      }),
    versionsOf: (level, query) => {
      const window = descending(query);
      return fetched(deps, () => {
        const rows = deps.store.all(VERSIONS, { level, below: window.below, limit: window.limit });
        return pageTo(
          rows.map((row) => ({ key: Number(row["version"]), item: versionOf(row) })),
          window,
        );
      });
    },
    versionOf: (level, version) =>
      fetched(deps, () => {
        const row = deps.store.all(ONE, { level, version })[0];
        return row === undefined ? undefined : versionOf(row);
      }),
  };
}
