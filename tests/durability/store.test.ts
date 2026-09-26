// The store itself: the schema it applies, the schema it refuses, and the file that outlives the
// process that wrote it. Everything else in this suite is about a port; this one is about the
// floor they all stand on, so when a gateway test fails it is not the first suspect.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
