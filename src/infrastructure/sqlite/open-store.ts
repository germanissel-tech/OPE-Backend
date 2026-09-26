// The SQLite engine behind `SqlStore`. This is the **only** file that imports `node:sqlite`: the
// adapters ring may not import this one, and a gateway takes its driver from here through its
// binding (ADR-013), so swapping the engine reaches no gateway.
//
// `node:sqlite` is synchronous and stable since Node 24, which is why the repository moved there:
// the feature adds no dependency at all.
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { SqlRow, SqlStore, SqlValue } from "../../interface-adapters/shared-kernel/index.js";

/** Where the versioned schema lives, relative to the working directory, as every other release file. */
const DEFAULT_MIGRATIONS_DIR = "migrations";

/** SQLite's own name for a database that never touches disk. */
const IN_MEMORY = ":memory:";

/** A migration is `NNN-<name>.sql`, and `NNN` is the version of the schema it leaves behind. */
const MIGRATION_FILE = /^(\d{3})-[a-z0-9-]+\.sql$/;

export interface SqliteOptions {
  /** The database file, or `:memory:`. */
  readonly file: string;
  /** Where the migrations are read from; the directory of the repository otherwise. */
  readonly migrations?: string;
}

/**
 * A store that is ready to be written to, or a refusal to start.
 *
 * An empty database gets the schema; one that already carries the expected version is used as it
 * is; **anything else stops the server and says what it expected** (FR-006). It is the rule that
 * already governs the configuration and the seed: a server running on something it does not
 * understand is worse than one that does not run, because it fails later and somewhere else.
 */
export function openSqliteStore(options: SqliteOptions): SqlStore {
  const dir = options.migrations ?? DEFAULT_MIGRATIONS_DIR;
  const migrations = readMigrations(dir);
  // One condition for the two things a file needs and a memory database does not, so there is a
  // single branch to get right instead of two that could disagree.
  // Stryker disable next-line ConditionalExpression: opening the store runs in a test hook, so the vitest runner cannot activate this reliably (ADR-016); applying it by hand does kill tests
  const onDisk = options.file !== IN_MEMORY;
  // SQLite creates the file but not the directory holding it, and its error for a missing one is
  // "unable to open database file", which names neither the path nor what is missing. A store
  // whose default location is `data/ope.db` would then fail on a fresh clone with nothing to go
  // on, so the directory is made rather than demanded.
  // Stryker disable next-line ConditionalExpression: opening the store runs in a test hook, so the vitest runner cannot activate this reliably (ADR-016); applying it by hand does kill tests
  if (onDisk) mkdirSync(path.dirname(options.file), { recursive: true });
  const database = new DatabaseSync(options.file);
  try {
    // WAL lets a read run while a write is in flight, and survives a process that dies mid-write.
    // A memory database has no journal to write, and asking leaves it in `memory` anyway.
    // Stryker disable next-line ConditionalExpression: opening the store runs in a test hook, so the vitest runner cannot activate this reliably (ADR-016); applying it by hand does kill tests
    if (onDisk) database.exec("PRAGMA journal_mode = WAL");
    prepareSchema(database, migrations, options.file);
  } catch (failure) {
    database.close();
    throw failure;
  }
  return storeOn(database);
}

/**
 * The migrations of this build, in the order they have to run.
 *
 * **They are asked for by version, not sorted.** `readdirSync` promises no order at all — ext4
 * answers in hash order — so sorting would be the only thing standing between a correct run and a
 * silent one, and no test can shuffle a directory listing to prove it works. Asking for 1, 2, 3 in
 * turn needs no comparator, and it finds the other mistake for free: a gap, which is what a
 * migration lost in a merge looks like.
 */
function readMigrations(dir: string): readonly Migration[] {
  const resolved = path.resolve(dir);
  const byVersion = new Map<number, string>();
  for (const name of readdirSync(resolved)) {
    const matched = MIGRATION_FILE.exec(name);
    if (matched !== null) byVersion.set(Number(matched[1]), path.join(resolved, name));
  }
  if (byVersion.size === 0) {
    throw new Error(`No migration found in ${resolved}: the store has no schema to apply.`);
  }
  return Array.from({ length: byVersion.size }, (_unused, index) => {
    const version = index + 1;
    const file = byVersion.get(version);
    if (file === undefined) {
      throw new Error(`No migration ${version} in ${resolved}: the versions of the schema skip one.`);
    }
    return { version, file };
  });
}

interface Migration {
  readonly version: number;
  readonly file: string;
}

function prepareSchema(database: DatabaseSync, migrations: readonly Migration[], file: string): void {
  const expected = migrations[migrations.length - 1]?.version ?? 0;
  const found = userVersion(database);
  if (found === expected) return;
  // A fresh file reports version 0 **and** holds nothing. A version 0 with tables in it is some
  // other database that happens to live at this path, and applying the schema over it would be
  // the silent corruption this check exists to prevent.
  // Stryker disable next-line ConditionalExpression: opening the store runs in a test hook, so the vitest runner cannot activate this reliably (ADR-016); applying it by hand does kill tests
  if (found === 0 && isEmpty(database)) {
    for (const migration of migrations) database.exec(readFileSync(migration.file, "utf8"));
    const applied = userVersion(database);
    if (applied !== expected) {
      throw new Error(
        `The migrations of this build leave schema version ${applied}, not the ${expected} their names announce.`,
      );
    }
    return;
  }
  throw new Error(
    `The store at ${file} holds schema version ${found}, and this build expects ${expected}. ` +
      `It was not migrated and it was not replaced, so nothing was written.`,
  );
}

function userVersion(database: DatabaseSync): number {
  const [row] = database.prepare("PRAGMA user_version").all();
  const version = row === undefined ? undefined : rowOf(row)["user_version"];
  return typeof version === "number" ? version : 0;
}

const isEmpty = (database: DatabaseSync): boolean =>
  database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().length === 0;

function storeOn(database: DatabaseSync): SqlStore {
  return {
    // A statement with no parameters is given an empty set rather than no argument at all: the
    // driver accepts it and answers the same, so the branch that told the two cases apart could
    // not change anything. The copy is what turns the readonly record into the mutable one the
    // named-parameter overload asks for.
    all: (sql, params) =>
      database
        .prepare(sql)
        .all({ ...params })
        .map(rowOf),
    run: (sql, params) => {
      database.prepare(sql).run({ ...params });
    },
    transaction: (work) => {
      database.exec("BEGIN");
      try {
        const result = work();
        database.exec("COMMIT");
        return result;
      } catch (failure) {
        database.exec("ROLLBACK");
        throw failure;
      }
    },
    close: () => {
      database.close();
    },
  };
}

/**
 * One row, narrowed. It takes the driver's own row type rather than `unknown`, so there is no
 * guard here for "not an object": the driver answers rows, and re-checking what a type already
 * states is a branch no input can take.
 *
 * The values are another matter. That type admits kinds this schema never stores —blobs, large
 * integers— because it describes SQLite and not us: **every column here is TEXT**. So a value of
 * another kind is not a case to convert, it is a store that is not the one this build wrote, and
 * the read says so instead of carrying it further.
 */
function rowOf(raw: Readonly<Record<string, unknown>>): SqlRow {
  return Object.fromEntries(Object.entries(raw).map(([column, value]) => [column, valueOf(column, value)]));
}

function valueOf(column: string, value: unknown): SqlValue {
  // `null` is not among them: every column of the schema is NOT NULL, so one coming back would be
  // a store this build did not write — the same case as a blob.
  if (typeof value === "string" || typeof value === "number") return value;
  throw new Error(`Column ${column} holds a ${typeof value}, which this schema never writes.`);
}
