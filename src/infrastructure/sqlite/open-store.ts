// The SQLite engine behind `SqlStore`. This is the **only** file that imports `node:sqlite`: the
// adapters ring may not import this one, and a gateway takes its driver from here through its
// binding (ADR-013), so swapping the engine reaches no gateway.
//
// `node:sqlite` is synchronous and stable since Node 24, which is why the repository moved there:
// the feature adds no dependency at all.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { SqlRow, SqlStore, SqlValue } from "../../interface-adapters/shared-kernel/index.js";

/** Where the versioned schema lives, relative to the working directory, as every other release file. */
const DEFAULT_MIGRATIONS_DIR = "migrations";

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
  const database = new DatabaseSync(options.file);
  try {
    // WAL lets a read run while a write is in flight, and survives a process that dies mid-write.
    // It is meaningless for an in-memory database, which the tests use, so it is not asked for.
    if (options.file !== ":memory:") database.exec("PRAGMA journal_mode = WAL");
    database.exec("PRAGMA foreign_keys = ON");
    prepareSchema(database, migrations, options.file);
  } catch (failure) {
    database.close();
    throw failure;
  }
  return storeOn(database);
}

/** The schema this build expects: the highest version its migrations leave behind. */
function readMigrations(dir: string): readonly Migration[] {
  const resolved = path.resolve(dir);
  const files = readdirSync(resolved)
    .map((name) => ({ name, matched: MIGRATION_FILE.exec(name) }))
    .flatMap(({ name, matched }) =>
      matched === null ? [] : [{ version: Number(matched[1]), file: path.join(resolved, name) }],
    )
    .sort((a, b) => a.version - b.version);
  if (files.length === 0)
    throw new Error(`No migration found in ${resolved}: the store has no schema to apply.`);
  return files;
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
  const row = rowOf(database.prepare("PRAGMA user_version").get());
  const version = row["user_version"];
  return typeof version === "number" ? version : 0;
}

const isEmpty = (database: DatabaseSync): boolean =>
  database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().length === 0;

function storeOn(database: DatabaseSync): SqlStore {
  return {
    all: (sql, params) => {
      const statement = database.prepare(sql);
      // The two calls are written out instead of spreading one argument list: the driver takes
      // named parameters through an overload, and a spread of `[params] | []` matches neither.
      // The copy is what turns the readonly record into the mutable one the overload asks for.
      return (params === undefined ? statement.all() : statement.all({ ...params })).map(rowOf);
    },
    run: (sql, params) => {
      const statement = database.prepare(sql);
      if (params === undefined) statement.run();
      else statement.run({ ...params });
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
 * One row, narrowed. The driver's own type admits values this schema never stores —blobs, large
 * integers— because it describes SQLite and not us: every column here is TEXT. So a value of
 * another kind is not a case to convert, it is a store that is not the one this build wrote, and
 * the read says so instead of carrying it further.
 */
function rowOf(raw: unknown): SqlRow {
  if (typeof raw !== "object" || raw === null)
    throw new Error("The store answered something that is not a row.");
  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>).map(([column, value]) => [column, valueOf(column, value)]),
  );
}

function valueOf(column: string, value: unknown): SqlValue {
  if (value === null || typeof value === "string" || typeof value === "number") return value;
  throw new Error(`Column ${column} holds a ${typeof value}, which this schema never writes.`);
}
