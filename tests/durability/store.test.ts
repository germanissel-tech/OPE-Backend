// The store itself: the schema it applies, the schema it refuses, and the file that outlives the
// process that wrote it. Everything else in this suite is about a port; this one is about the
// floor they all stand on, so when a gateway test fails it is not the first suspect.
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openSqliteStore } from "../../src/infrastructure/sqlite/open-store.js";

/** SQLite own name for a database that never touches disk; the store takes it verbatim. */
const IN_MEMORY = ":memory:";

describe("the durable store", () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "ope-store-"));
    file = path.join(dir, "ope.db");
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("applies the schema to an empty file and finds it again on the next open", () => {
    const first = openSqliteStore({ file });
    first.run("INSERT INTO exposures (merchant_id, decision_id, document) VALUES (:m, :d, :doc)", {
      m: "m-1",
      d: "d-1",
      doc: "{}",
    });
    first.close();

    const reopened = openSqliteStore({ file });
    expect(reopened.all("SELECT document FROM exposures WHERE merchant_id = :m", { m: "m-1" })).toEqual([
      { document: "{}" },
    ]);
    reopened.close();
  });

  it("refuses to start against a schema it does not expect, and says which one it wanted", () => {
    const foreign = openSqliteStore({ file });
    foreign.run("PRAGMA user_version = 99", {});
    foreign.close();

    expect(() => openSqliteStore({ file })).toThrow(/version 99.*expects 1/s);
  });

  it("refuses a database that is not ours rather than applying the schema over it", () => {
    // Version 0 with tables in it is somebody else's database at our path. Applying the schema
    // would be exactly the silent corruption the check exists to prevent.
    const other = openSqliteStore({ file });
    other.run("PRAGMA user_version = 0", {});
    other.close();

    expect(() => openSqliteStore({ file })).toThrow(/version 0.*expects 1/s);
  });

  it("closes the database when the start is refused, instead of leaving it open", () => {
    // A refused start must not leave the connection behind. It is observable without reaching the
    // driver: in WAL mode SQLite keeps `-wal` and `-shm` beside the file while a connection is
    // open and removes them when it closes cleanly.
    //
    // **This is the case CI caught and this machine could not.** On Windows the teardown already
    // killed it — a directory holding an open file cannot be removed — so the mutant that deletes
    // the `close()` died here and survived on Linux, where the removal succeeds either way.
    const foreign = openSqliteStore({ file });
    foreign.run("PRAGMA user_version = 99", {});
    foreign.close();

    expect(() => openSqliteStore({ file })).toThrow(/version 99/);

    expect(existsSync(`${file}-wal`)).toBe(false);
    expect(existsSync(`${file}-shm`)).toBe(false);
  });

  it("rolls a transaction back when the work inside it throws", () => {
    const store = openSqliteStore({ file });
    expect(() =>
      store.transaction(() => {
        store.run("INSERT INTO exposures (merchant_id, decision_id, document) VALUES (:m, :d, :doc)", {
          m: "m-1",
          d: "d-1",
          doc: "{}",
        });
        throw new Error("something went wrong halfway");
      }),
    ).toThrow("something went wrong halfway");
    expect(store.all("SELECT document FROM exposures")).toEqual([]);
    store.close();
  });

  it("creates the directory holding the file, because SQLite does not", () => {
    // Found by running the quickstart, not by a test: every test here starts from `mkdtemp`, so
    // the directory always existed. `npm run dev` on a fresh clone has no `data/`, and SQLite
    // answered "unable to open database file" — naming neither the path nor what was missing.
    const nested = path.join(dir, "deeper", "still", "ope.db");
    const store = openSqliteStore({ file: nested });
    store.run("INSERT INTO exposures (merchant_id, decision_id, document) VALUES (:m, :d, :doc)", {
      m: "m-1",
      d: "d-1",
      doc: "{}",
    });
    store.close();
    const reopened = openSqliteStore({ file: nested });
    expect(reopened.all("SELECT document FROM exposures")).toHaveLength(1);
    // Closed before the teardown: on Windows a directory holding an open file cannot be removed.
    reopened.close();
  });

  it("says so when the build has no migration to apply", () => {
    const empty = mkdtempSync(path.join(tmpdir(), "ope-no-migrations-"));
    writeFileSync(path.join(empty, "notes.txt"), "not a migration");
    try {
      expect(() => openSqliteStore({ file, migrations: empty })).toThrow(/no schema to apply/);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it("hands a null back as a null, and refuses a value of a kind it never writes", () => {
    // No column of this schema is nullable, but `SqlStore` is what every durable gateway is
    // written against: a nullable column or an outer join will read one. Found by reading
    // `sqlite_master`, whose `sql` is null for an implicit index — the store threw.
    const store = openSqliteStore({ file });
    try {
      // The aliases avoid SQLite's keywords (`nothing` is one, from `DO NOTHING`).
      expect(store.all("SELECT NULL AS absent, 'text' AS present, 1 AS quantity")).toEqual([
        { absent: null, present: "text", quantity: 1 },
      ]);
      // A blob is a different matter: it is a store this build did not write, and the read says so
      // instead of carrying it further.
      expect(() => store.all("SELECT x'00' AS bytes")).toThrow(
        /holds a object, which this schema never writes/,
      );
    } finally {
      // In a `finally` because a failing expectation above would otherwise leave the file open,
      // and on Windows the teardown cannot remove a directory that holds one.
      store.close();
    }
  });

  it("puts a file in WAL, and leaves a memory database alone", () => {
    // WAL is what lets a read run while a write is in flight and what survives a process that
    // dies mid-write, so it is not decoration: a store that quietly fell back to the rollback
    // journal would behave differently exactly when it matters.
    const onDisk = openSqliteStore({ file });
    expect(onDisk.all("PRAGMA journal_mode")).toEqual([{ journal_mode: "wal" }]);
    onDisk.close();

    const inMemory = openSqliteStore({ file: IN_MEMORY });
    expect(inMemory.all("PRAGMA journal_mode")).toEqual([{ journal_mode: "memory" }]);
    inMemory.close();
  });

  describe("a build with more than one migration", () => {
    let schema: string;

    /** Writes `NNN-<name>.sql`; each one leaves the schema at its own version. */
    const migration = (n: string, sql: string): void => {
      writeFileSync(path.join(schema, `${n}-step.sql`), `${sql}\nPRAGMA user_version = ${Number(n)};\n`);
    };

    beforeEach(() => {
      schema = mkdtempSync(path.join(tmpdir(), "ope-migrations-"));
    });

    afterEach(() => {
      rmSync(schema, { recursive: true, force: true });
    });

    it("applies them in the order of their number and expects the last one's version", () => {
      // The order is not decoration either: the second one here alters what the first created, so
      // running them the other way round fails outright.
      migration("001", "CREATE TABLE step (a TEXT);");
      migration("002", "ALTER TABLE step ADD COLUMN b TEXT;");

      const store = openSqliteStore({ file, migrations: schema });
      store.run("INSERT INTO step (a, b) VALUES (:a, :b)", { a: "1", b: "2" });
      expect(store.all("PRAGMA user_version")).toEqual([{ user_version: 2 }]);
      store.close();
    });

    it("refuses a build whose migration numbers skip one", () => {
      // A gap is what a migration lost in a merge looks like, and applying the rest would leave a
      // schema nobody described. It is found because the versions are asked for in turn.
      migration("001", "CREATE TABLE step (a TEXT);");
      migration("003", "CREATE TABLE later (b TEXT);");

      expect(() => openSqliteStore({ file, migrations: schema })).toThrow(
        /No migration 2 in .*: the versions of the schema skip one/,
      );
    });

    it("applies only the pending migration to a store one version behind, and keeps its rows", () => {
      // **The case feature 030 left out and 031 needs.** That feature declared "nothing to
      // migrate" because there was no data anywhere, so a store could only be empty or current.
      // The second migration of this repository makes a store that is one version behind an
      // ordinary thing, and the old runner refused to start against it.
      migration("001", "CREATE TABLE step (a TEXT);");
      const before = openSqliteStore({ file, migrations: schema });
      before.run("INSERT INTO step (a) VALUES (:a)", { a: "written under version 1" });
      before.close();

      migration("002", "ALTER TABLE step ADD COLUMN b TEXT;");
      const after = openSqliteStore({ file, migrations: schema });
      expect(after.all("PRAGMA user_version")).toEqual([{ user_version: 2 }]);
      // The row has to survive: a migration that starts from scratch is not a migration.
      expect(after.all("SELECT a, b FROM step")).toEqual([{ a: "written under version 1", b: null }]);
      after.close();
    });

    it("does nothing to a store already at the expected version", () => {
      // Re-running 002 would throw outright (a duplicate column), so a clean reopen is the
      // observation: the runner asks for what is pending, not for everything it has.
      migration("001", "CREATE TABLE step (a TEXT);");
      migration("002", "ALTER TABLE step ADD COLUMN b TEXT;");
      const first = openSqliteStore({ file, migrations: schema });
      first.run("INSERT INTO step (a, b) VALUES (:a, :b)", { a: "1", b: "2" });
      first.close();

      const reopened = openSqliteStore({ file, migrations: schema });
      expect(reopened.all("SELECT a, b FROM step")).toEqual([{ a: "1", b: "2" }]);
      reopened.close();
    });

    it("leaves nothing behind when a pending migration fails halfway", () => {
      // Each migration runs in its own transaction, and this is the case that makes that matter:
      // the 002 of this repository rebuilds seven tables, so a failure in the middle without a
      // rollback would leave a schema that is neither the old one nor the new one — and the
      // version would still say the old one, so the next start would try again over the debris.
      migration("001", "CREATE TABLE step (a TEXT);");
      const before = openSqliteStore({ file, migrations: schema });
      before.run("INSERT INTO step (a) VALUES (:a)", { a: "survives" });
      before.close();

      migration("002", "CREATE TABLE half (b TEXT);\nCREATE TABLE half (b TEXT);");
      expect(() => openSqliteStore({ file, migrations: schema })).toThrow();

      // Nothing of the failed migration is left, and the store is still usable as version 1.
      migration("002", "ALTER TABLE step ADD COLUMN b TEXT;");
      const recovered = openSqliteStore({ file, migrations: schema });
      expect(recovered.all("PRAGMA user_version")).toEqual([{ user_version: 2 }]);
      expect(recovered.all("SELECT a FROM step")).toEqual([{ a: "survives" }]);
      expect(recovered.all("SELECT name FROM sqlite_master WHERE name = 'half'")).toEqual([]);
      recovered.close();
    });

    it("refuses a build whose migrations do not leave the version their names announce", () => {
      // A migration named 002 that forgets to bump `user_version` leaves the store one version
      // behind for ever, and every later start would try to apply it again.
      writeFileSync(
        path.join(schema, "001-step.sql"),
        "CREATE TABLE step (a TEXT);\nPRAGMA user_version = 1;\n",
      );
      writeFileSync(path.join(schema, "002-step.sql"), "ALTER TABLE step ADD COLUMN b TEXT;\n");

      expect(() => openSqliteStore({ file, migrations: schema })).toThrow(
        /leave schema version 1, not the 2 their names announce/,
      );
    });
  });
});
