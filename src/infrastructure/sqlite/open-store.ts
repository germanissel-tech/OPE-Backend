// The SQLite engine behind `SqlStore`. This is the **only** file that imports `node:sqlite`: the
// adapters ring may not import this one, and a gateway takes its driver from here through its
// binding (ADR-013), so swapping the engine reaches no gateway.
//
// `node:sqlite` is synchronous and stable since Node 24, which is why the repository moved there:
// the feature adds no dependency at all.
import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { StoreUnavailable, fail, ok } from "../../domain/shared-kernel/index.js";
import type { SqlRow, SqlStore, SqlValue } from "../../interface-adapters/shared-kernel/index.js";

/** Where the versioned schema lives, relative to the working directory, as every other release file. */
const DEFAULT_MIGRATIONS_DIR = "migrations";

/** SQLite's own name for a database that never touches disk. */
const IN_MEMORY = ":memory:";

/**
 * The three words of a transaction, named once because they are written from two places —the synchronous
 * transaction and the unit of work— and they are the same transaction seen from two kinds of caller.
 */
const BEGIN = "BEGIN";
const COMMIT = "COMMIT";
const ROLLBACK = "ROLLBACK";

/** How much of a statement an error quotes: enough to find it, not enough to dump a document. */
const STATEMENT_IN_ERROR = 60;

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
 * An empty database gets the whole schema; one some versions behind gets only what it is missing;
 * one that already carries the expected version is used as it is; **anything else stops the server
 * and says what it expected** (FR-006). It is the rule that already governs the configuration and
 * the seed: a server running on something it does not understand is worse than one that does not
 * run, because it fails later and somewhere else.
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
  // A fresh file reports version 0 **and** holds nothing. A version 0 with tables in it is some
  // other database that happens to live at this path, and applying the schema over it would be
  // the silent corruption this check exists to prevent.
  // Stryker disable next-line ConditionalExpression: opening the store runs in a test hook, so the vitest runner cannot activate this reliably (ADR-016); applying it by hand does kill tests
  const fresh = found === 0 && isEmpty(database);
  // Anything from 1 up to the expected version is **our** store, at or behind this build. Feature
  // 030 could refuse everything but the expected one, because it declared there was nothing to
  // migrate anywhere; from the second migration on, a store some versions behind is the ordinary
  // case, and refusing it would make every schema change a manual procedure nobody wrote down.
  const ours = found > 0 && found <= expected;
  if (!fresh && !ours) {
    throw new Error(
      `The store at ${file} holds schema version ${found}, and this build expects ${expected}. ` +
        `It was not migrated and it was not replaced, so nothing was written.`,
    );
  }
  // Only what is missing — and a store already at the expected version is **not a special case**,
  // it is this loop finding nothing to do. Writing it as an early return above instead left the
  // `found === expected` boundary unreachable here, so `<` and `<=` became indistinguishable and a
  // mutant of the comparison survived: the branch that could not be observed was the one saying
  // too much.
  for (const migration of migrations) {
    if (migration.version > found) applyMigration(database, migration);
  }
  const applied = userVersion(database);
  if (applied !== expected) {
    throw new Error(
      `The migrations of this build leave schema version ${applied}, not the ${expected} their names announce.`,
    );
  }
}

/**
 * All of the work, or none of it.
 *
 * The two callers need the same three words in the same order, and writing them twice is what the
 * magic-string rule catches: they are not two transactions that happen to look alike, they are one.
 * A migration cannot go through `SqlStore.transaction` instead, because it runs while the schema is
 * still being prepared and there is no store yet — only the driver.
 */
function inTransaction<T>(database: DatabaseSync, work: () => T): T {
  database.exec(BEGIN);
  try {
    const result = work();
    database.exec(COMMIT);
    return result;
  } catch (failure) {
    database.exec(ROLLBACK);
    throw failure;
  }
}

/**
 * One migration, all of it or none of it.
 *
 * The transaction is what makes a migration that rebuilds tables safe to run against a store with
 * data in it: SQLite cannot add a primary key to an existing table, so such a migration creates,
 * copies, drops and renames. Halfway through that without a rollback the store would be neither the
 * old shape nor the new one — and `user_version` would still say the old one, so the next start
 * would run the same migration again over the debris.
 */
function applyMigration(database: DatabaseSync, migration: Migration): void {
  inTransaction(database, () => {
    database.exec(readFileSync(migration.file, "utf8"));
  });
}

function userVersion(database: DatabaseSync): number {
  const [row] = database.prepare("PRAGMA user_version").all();
  const version = row === undefined ? undefined : rowOf(row)["user_version"];
  return typeof version === "number" ? version : 0;
}

const isEmpty = (database: DatabaseSync): boolean =>
  database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().length === 0;

/**
 * The unit of work that is open right now, if there is one, and who owns it.
 *
 * **`AsyncLocalStorage` is what distinguishes the owner from everybody else**, and without that
 * distinction the guard below could not exist: a flag alone cannot tell "I am inside my own unit" from "I
 * found somebody else's open", so it would either block the owner — a deadlock — or protect nobody.
 *
 * It is the first use of `node:async_hooks` in the repository, and it is here because this is the ring
 * that hosts technology (ADR-013).
 */
const openUnit = new AsyncLocalStorage<Unit>();

/** One unit of work, as everybody else sees it: the promise that resolves when it closes. */
interface Unit {
  readonly closed: Promise<void>;
}

/**
 * The store as a gateway sees it: statements, the synchronous transaction, and the unit of work that
 * feature 034 added so that an asynchronous caller can compose several writes into one.
 *
 * **`held` is deliberately a single slot and not a queue of units.** There is one writer in SQLite and one
 * process in this deployment (D-21), so two units at once are not a case to support but a case to make
 * impossible: the second waits for the first through the same turn everybody else waits for.
 */
function storeOn(database: DatabaseSync): SqlStore {
  let held: Unit | undefined;

  /**
   * The guard. A statement from outside the open unit would land **inside** somebody else's transaction —
   * it would be committed or reverted by a decision that is not its own, and a read would see what that
   * transaction has not committed. Whoever forgot to wait its turn has a programming error, and in this
   * project those are thrown (ADR-023).
   */
  const mine = (): boolean => held === undefined || openUnit.getStore() === held;
  const guard = (sql: string): void => {
    if (mine()) return;
    throw new Error(
      `A unit of work is open and this statement did not wait its turn: ${sql.trimStart().slice(0, STATEMENT_IN_ERROR)}`,
    );
  };

  const all = (sql: string, params?: Readonly<Record<string, SqlValue>>): readonly SqlRow[] => {
    guard(sql);
    // A statement with no parameters is given an empty set rather than no argument at all: the
    // driver accepts it and answers the same, so the branch that told the two cases apart could
    // not change anything. The copy is what turns the readonly record into the mutable one the
    // named-parameter overload asks for.
    return database
      .prepare(sql)
      .all({ ...params })
      .map(rowOf);
  };

  const run = (sql: string, params?: Readonly<Record<string, SqlValue>>): void => {
    guard(sql);
    database.prepare(sql).run({ ...params });
  };

  /**
   * Opens the transaction **synchronously** and then runs the asynchronous work inside it.
   *
   * The `BEGIN` is not deferred on purpose: between calling this and its first `await` nothing else may
   * write, and a `BEGIN` that waited for a tick would leave exactly that gap. What the unit adds over
   * `transaction` is only that the work may await; the atomicity is the same one the engine already gave.
   */
  const scope: SqlStore["scope"] = async (work) => {
    // A unit that finds another open waits for its turn like everybody else, so `held` is never
    // overwritten and the second unit does not nest inside the first.
    await enter();
    let close = (): void => undefined;
    const closed = new Promise<void>((resolve) => {
      close = resolve;
    });
    const unit: Unit = { closed };
    held = unit;
    database.exec(BEGIN);
    // A field and not a local `let`, and that is not a style choice: assigned only inside the callback,
    // a local stays narrowed to `false` for the compiler and the two branches below read as dead code.
    const reverting = { asked: false };
    const abort = (): void => {
      reverting.asked = true;
    };
    try {
      const value = await openUnit.run(unit, () => work(abort));
      // `abort` is the caller saying "revert", and it is the only failure this unit reports: anything
      // else the work throws is a programming error and travels as one.
      database.exec(reverting.asked ? ROLLBACK : COMMIT);
      return reverting.asked ? fail(new StoreUnavailable()) : ok(value);
    } catch (failure) {
      database.exec(ROLLBACK);
      throw failure;
    } finally {
      // **In a `finally` and not after each branch**: a unit that ended without releasing its turn stops
      // every write of the process, which is the one failure of this file nothing else would catch
      // (FR-012).
      held = undefined;
      close();
    }
  };

  /** The turn: at once unless somebody else's unit is open, and then when it closes. */
  async function enter(): Promise<void> {
    // A `while` and not an `if`: between this unit closing and this caller running, another one may have
    // opened, and waiting for the first is not waiting for the second.
    while (held !== undefined && openUnit.getStore() !== held) await held.closed;
  }

  return {
    all,
    run,
    transaction: (work) => inTransaction(database, work),
    scope,
    enter,
    busy: () => !mine(),
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
  // `null` is one of them, although every column of *this* schema is NOT NULL: `SqlStore` is the
  // interface every durable gateway is written against, and a query may well read a nullable
  // column or an outer join. Refusing it because today's tables happen not to need it would be a
  // trap for the next gateway — and it was one already: reading `sqlite_master`, whose `sql` is
  // null for an implicit index, threw.
  if (value === null || typeof value === "string" || typeof value === "number") return value;
  throw new Error(`Column ${column} holds a ${typeof value}, which this schema never writes.`);
}
