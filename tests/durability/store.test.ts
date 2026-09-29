// The store itself: the schema it applies, the schema it refuses, and the file that outlives the
// process that wrote it. Everything else in this suite is about a port; this one is about the
// floor they all stand on, so when a gateway test fails it is not the first suspect.
import { copyFileSync, existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openSqliteStore } from "../../src/infrastructure/sqlite/open-store.js";

/** SQLite own name for a database that never touches disk; the store takes it verbatim. */
const IN_MEMORY = ":memory:";

/**
 * The seven tables feature 030 created, which feature 031 rebuilt to the owner's two rules. Written
 * out rather than read from the schema on purpose: a test that asks the store which tables it has
 * would pass against a store that lost one.
 */
const TABLES_OF_THE_LEDGER = [
  "decisions",
  "exposures",
  "orders",
  "corroborations",
  "assignments",
  "catalog_snapshots",
  "catalog_receipts",
] as const;

/**
 * The seven tables feature 033 created for its **six** stores — the origins of a merchant get one of
 * their own, because their uniqueness is between merchants and only an index can enforce it. What an
 * operator configures, plus what was observed of a merchant's traffic.
 *
 * Written out for the same reason as the list above: a test that asked the store which tables it has
 * would pass against a store that lost one.
 */
const TABLES_OF_THE_CONFIGURATION = [
  "merchants",
  "merchant_origins",
  "merchant_configurations",
  "experiments",
  "admin_entries",
  "anchor_diagnostics",
  "unmapped_values",
] as const;

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

    // The expected version is not written out here on purpose: it goes up with every migration, and
    // a test that spells it makes each one break two assertions that were not about it. What matters
    // is that the refusal names **both** numbers.
    expect(() => openSqliteStore({ file })).toThrow(/version 99.*expects \d+/s);
  });

  it("refuses a database that is not ours rather than applying the schema over it", () => {
    // Version 0 with tables in it is somebody else's database at our path. Applying the schema
    // would be exactly the silent corruption the check exists to prevent.
    const other = openSqliteStore({ file });
    other.run("PRAGMA user_version = 0", {});
    other.close();

    expect(() => openSqliteStore({ file })).toThrow(/version 0.*expects \d+/s);
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
    // `SqlStore` is what every durable gateway is written against, and a nullable column or an outer
    // join will read a null. Found by reading `sqlite_master`, whose `sql` is null for an implicit
    // index — the store threw.
    //
    // When this was written no column of the schema was nullable. Since feature 033 one is:
    // `admin_entries.merchant_id`, where the absence **means** an action of the platform and not of a
    // merchant. So this stopped being a guard for a case that could not happen.
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

  describe("the migration of this repository, against a store that already has rows", () => {
    // **Not a fake schema: the real files.** The suite's other stores are created fresh and get every
    // migration in one go, which is the one case that cannot show whether a rebuild works. This one
    // opens a store with only `001`, fills all seven tables, and then lets `002` upgrade it — which is
    // what happens on the machine of anyone who ran feature 030.
    let schema: string;
    const REAL = path.resolve("migrations");

    /** Copies the real migration files up to `upTo` into the directory the store is opened against. */
    const withMigrationsUpTo = (upTo: number): void => {
      for (const name of readdirSync(REAL)) {
        const version = /^(\d{3})-/.exec(name)?.[1];
        if (version !== undefined && Number(version) <= upTo) {
          copyFileSync(path.join(REAL, name), path.join(schema, name));
        }
      }
    };

    beforeEach(() => {
      schema = mkdtempSync(path.join(tmpdir(), "ope-real-migrations-"));
    });

    afterEach(() => {
      rmSync(schema, { recursive: true, force: true });
    });

    it("upgrades a populated version-1 store and loses nothing", () => {
      withMigrationsUpTo(1);
      const before = openSqliteStore({ file, migrations: schema });
      expect(before.all("PRAGMA user_version")).toEqual([{ user_version: 1 }]);
      // One row in each of the seven, so the rebuild has something to carry over everywhere.
      before.run(
        "INSERT INTO decisions (merchant_id, decision_id, session_id, document) VALUES ('m-1','d-1','s-1','{}')",
        {},
      );
      before.run("INSERT INTO exposures (merchant_id, decision_id, document) VALUES ('m-1','d-1','{}')", {});
      before.run("INSERT INTO orders (merchant_id, order_id, document) VALUES ('m-1','o-1','{}')", {});
      before.run(
        "INSERT INTO corroborations (merchant_id, order_id, session_id, document) VALUES ('m-1','o-1','s-1','{}')",
        {},
      );
      before.run(
        "INSERT INTO assignments (merchant_id, experiment_id, visitor_id, document) VALUES ('m-1','e-1','v-1','{}')",
        {},
      );
      before.run("INSERT INTO catalog_snapshots (merchant_id, document) VALUES ('m-1','{}')", {});
      before.run(
        "INSERT INTO catalog_receipts (merchant_id, received_at) VALUES ('m-1','2026-09-27T00:00:00.000Z')",
        {},
      );
      before.close();

      withMigrationsUpTo(2);
      const after = openSqliteStore({ file, migrations: schema });
      try {
        expect(after.all("PRAGMA user_version")).toEqual([{ user_version: 2 }]);
        for (const table of TABLES_OF_THE_LEDGER) {
          expect(after.all(`SELECT COUNT(*) AS n FROM ${table}`)).toEqual([{ n: 1 }]);
        }
        // The register is there and empty: nothing invented rows for it.
        expect(after.all("SELECT COUNT(*) AS n FROM received_events")).toEqual([{ n: 0 }]);
        // And the row that was written under version 1 kept what it said.
        expect(after.all("SELECT decision_id, session_id, document FROM decisions")).toEqual([
          { decision_id: "d-1", session_id: "s-1", document: "{}" },
        ]);
      } finally {
        after.close();
      }
    });

    it("gives every table the two rules of the owner, and the same instant on a new row", () => {
      withMigrationsUpTo(2);
      const store = openSqliteStore({ file, migrations: schema });
      try {
        for (const table of [...TABLES_OF_THE_LEDGER, "received_events"]) {
          const columns = store.all(`SELECT name, type, pk FROM pragma_table_info('${table}')`);
          // Rule 1: its own autoincrementing primary key, and it is the only primary-key column.
          expect(columns.filter((c) => c["pk"] === 1)).toEqual([{ name: "id", type: "INTEGER", pk: 1 }]);
          expect(
            store.all(`SELECT name FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'`),
          ).toHaveLength(1);
          // Rule 2: both timestamps exist.
          const names = columns.map((c) => c["name"]);
          expect(names).toContain("created_at");
          expect(names).toContain("updated_at");
        }
        // Rule 2, the part that is a behaviour and not a column: equal when the row is created.
        store.run(
          "INSERT INTO decisions (merchant_id, decision_id, session_id, document) VALUES ('m-1','d-2','s-1','{}')",
          {},
        );
        const [row] = store.all("SELECT created_at, updated_at FROM decisions WHERE decision_id = 'd-2'");
        expect(row?.["created_at"]).toBe(row?.["updated_at"]);
        expect(row?.["created_at"]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      } finally {
        store.close();
      }
    });

    it("keeps the uniqueness the primary keys used to give, now as indexes", () => {
      withMigrationsUpTo(2);
      const store = openSqliteStore({ file, migrations: schema });
      try {
        store.run(
          "INSERT INTO decisions (merchant_id, decision_id, session_id, document) VALUES ('m-1','d-1','s-1','{}')",
          {},
        );
        // The business key moved from PRIMARY KEY to a UNIQUE index; what it guarantees did not move.
        expect(() => {
          store.run(
            "INSERT INTO decisions (merchant_id, decision_id, session_id, document) VALUES ('m-1','d-1','s-2','{}')",
            {},
          );
        }).toThrow(/UNIQUE/i);
        // And the register is the opposite on purpose: the same event arriving twice is two rows.
        const arrival = (batch: string, position: number): void => {
          store.run(
            `INSERT INTO received_events (merchant_id, batch_id, position, event_id, session_id, type, received_at, disposition, document)
             VALUES ('m-1', :batch, :position, 'evt-1', 's-1', 'product_viewed', '2026-09-27T00:00:00.000Z', 'accepted', '{}')`,
            { batch, position },
          );
        };
        arrival("b-1", 0);
        arrival("b-2", 0);
        expect(store.all("SELECT COUNT(*) AS n FROM received_events WHERE event_id = 'evt-1'")).toEqual([
          { n: 2 },
        ]);
        // What the register does refuse is the same arrival twice, which is the idempotency of the write.
        expect(() => {
          arrival("b-1", 0);
        }).toThrow(/UNIQUE/i);
      } finally {
        store.close();
      }
    });
    it("upgrades a populated version-2 store, fills the visitor of every decision and loses nothing", () => {
      // Migration 003 pulls `visitorId` out of the document into a column of its own. The assertion
      // that matters is not that the upgrade works but that **no row is left with an empty visitor**:
      // a fill that silently misses one does not break anything — it makes the read by visitor lie,
      // and a cap that stops applying is exactly the damage this feature exists to undo.
      withMigrationsUpTo(2);
      const before = openSqliteStore({ file, migrations: schema });
      expect(before.all("PRAGMA user_version")).toEqual([{ user_version: 2 }]);
      // Two merchants and two visitors, so the fill has to read each document and not one of them.
      const decided = (merchant: string, decision: string, session: string, visitor: string): void => {
        before.run(
          `INSERT INTO decisions (merchant_id, decision_id, session_id, document)
           VALUES (:merchant, :decision, :session, :document)`,
          { merchant, decision, session, document: JSON.stringify({ visitorId: visitor, outcome: "NO_OP" }) },
        );
      };
      decided("m-1", "d-1", "s-1", "v-1");
      decided("m-1", "d-2", "s-1", "v-2");
      decided("m-2", "d-3", "s-2", "v-3");
      // A row in a table this migration does not touch, to see that rebuilding one leaves the rest alone.
      before.run("INSERT INTO exposures (merchant_id, decision_id, document) VALUES ('m-1','d-1','{}')", {});
      const [written] = before.all("SELECT created_at FROM decisions WHERE decision_id = 'd-1'");
      before.close();

      withMigrationsUpTo(3);
      const after = openSqliteStore({ file, migrations: schema });
      try {
        expect(after.all("PRAGMA user_version")).toEqual([{ user_version: 3 }]);
        // Not one row with the visitor missing, blank or the string SQLite would write for a JSON null.
        expect(
          after.all(
            `SELECT COUNT(*) AS n FROM decisions WHERE visitor_id IS NULL OR visitor_id = '' OR visitor_id = 'null'`,
          ),
        ).toEqual([{ n: 0 }]);
        expect(after.all("SELECT decision_id, visitor_id FROM decisions ORDER BY id")).toEqual([
          { decision_id: "d-1", visitor_id: "v-1" },
          { decision_id: "d-2", visitor_id: "v-2" },
          { decision_id: "d-3", visitor_id: "v-3" },
        ]);
        // The document is untouched: the column is a copy for the index, not a move.
        expect(after.all("SELECT document FROM decisions WHERE decision_id = 'd-3'")).toEqual([
          { document: JSON.stringify({ visitorId: "v-3", outcome: "NO_OP" }) },
        ]);
        // And `created_at` is carried over, not regenerated: this migration is not when the row appeared.
        expect(after.all("SELECT created_at FROM decisions WHERE decision_id = 'd-1'")).toEqual([written]);
        // And the table this migration does not name kept its row: rebuilding one is not rebuilding all.
        expect(after.all("SELECT decision_id FROM exposures")).toEqual([{ decision_id: "d-1" }]);
      } finally {
        after.close();
      }
    });

    it("refuses a decision without a visitor, instead of writing a row the read by visitor cannot find", () => {
      withMigrationsUpTo(3);
      const store = openSqliteStore({ file, migrations: schema });
      try {
        // `NOT NULL` is the whole reason the table is rebuilt rather than altered: a gateway that
        // forgets the visitor fails here, when it is a bug, and not months later as a cap that
        // quietly stopped counting.
        expect(() => {
          store.run(
            "INSERT INTO decisions (merchant_id, decision_id, session_id, document) VALUES ('m-1','d-9','s-1','{}')",
            {},
          );
        }).toThrow(/NOT NULL/i);
      } finally {
        store.close();
      }
    });
    it("upgrades a populated version-3 store by only adding: what it already held is untouched", () => {
      // Migration 004 is the first of this series that **only creates**. The two before it rebuilt
      // tables — copy, drop, rename — so what they had to prove was that nothing was lost in the
      // traspaso. Here the thing to prove is the opposite and it is easy to get wrong by writing a
      // migration that reaches for a table it has no business touching.
      withMigrationsUpTo(3);
      const before = openSqliteStore({ file, migrations: schema });
      expect(before.all("PRAGMA user_version")).toEqual([{ user_version: 3 }]);
      // One row in each of the seven, plus one arrival, so "untouched" has something to be about.
      before.run(
        `INSERT INTO decisions (merchant_id, decision_id, session_id, visitor_id, document)
         VALUES ('m-1','d-1','s-1','v-1','{}')`,
        {},
      );
      before.run("INSERT INTO exposures (merchant_id, decision_id, document) VALUES ('m-1','d-1','{}')", {});
      before.run("INSERT INTO orders (merchant_id, order_id, document) VALUES ('m-1','o-1','{}')", {});
      before.run(
        "INSERT INTO corroborations (merchant_id, order_id, session_id, document) VALUES ('m-1','o-1','s-1','{}')",
        {},
      );
      before.run(
        "INSERT INTO assignments (merchant_id, experiment_id, visitor_id, document) VALUES ('m-1','e-1','v-1','{}')",
        {},
      );
      before.run("INSERT INTO catalog_snapshots (merchant_id, document) VALUES ('m-1','{}')", {});
      before.run(
        "INSERT INTO catalog_receipts (merchant_id, received_at) VALUES ('m-1','2026-09-29T00:00:00.000Z')",
        {},
      );
      before.run(
        `INSERT INTO received_events (merchant_id, batch_id, position, event_id, session_id, type, received_at, disposition, document)
         VALUES ('m-1','b-1',0,'evt-1','s-1','product_viewed','2026-09-29T00:00:00.000Z','accepted','{}')`,
        {},
      );
      const [decision] = before.all("SELECT created_at, document FROM decisions WHERE decision_id = 'd-1'");
      before.close();

      withMigrationsUpTo(4);
      const after = openSqliteStore({ file, migrations: schema });
      try {
        expect(after.all("PRAGMA user_version")).toEqual([{ user_version: 4 }]);
        // Every table that existed still holds its row, and the decision kept its instant: nothing
        // was rebuilt, so nothing regenerated a timestamp.
        for (const table of [...TABLES_OF_THE_LEDGER, "received_events"]) {
          expect(after.all(`SELECT COUNT(*) AS n FROM ${table}`)).toEqual([{ n: 1 }]);
        }
        expect(after.all("SELECT created_at, document FROM decisions WHERE decision_id = 'd-1'")).toEqual([
          decision,
        ]);
        // And the six new ones are there and empty: nothing invented rows for them.
        for (const table of TABLES_OF_THE_CONFIGURATION) {
          expect(after.all(`SELECT COUNT(*) AS n FROM ${table}`)).toEqual([{ n: 0 }]);
        }
      } finally {
        after.close();
      }
    });

    it("gives the six new tables the two rules of the owner", () => {
      withMigrationsUpTo(4);
      const store = openSqliteStore({ file, migrations: schema });
      try {
        for (const table of TABLES_OF_THE_CONFIGURATION) {
          const columns = store.all(`SELECT name, type, pk FROM pragma_table_info('${table}')`);
          expect(columns.filter((c) => c["pk"] === 1)).toEqual([{ name: "id", type: "INTEGER", pk: 1 }]);
          const names = columns.map((c) => c["name"]);
          expect(names).toContain("created_at");
          expect(names).toContain("updated_at");
        }
      } finally {
        store.close();
      }
    });

    it("reserves an origin for one merchant only, deactivated ones included", () => {
      // The one uniqueness of this schema that is **between** merchants, and the reason the origins
      // live in their own table: inside a document no index can enforce it, and enforcing it by
      // reading before writing is the race `01 §6` forbids.
      withMigrationsUpTo(4);
      const store = openSqliteStore({ file, migrations: schema });
      try {
        const claim = (merchant: string, origin: string): void => {
          store.run("INSERT INTO merchant_origins (merchant_id, origin) VALUES (:m, :o)", {
            m: merchant,
            o: origin,
          });
        };
        claim("m-1", "https://a.example");
        expect(() => {
          claim("m-2", "https://a.example");
        }).toThrow(/UNIQUE/i);
        // Two merchants can hold different origins, which is what makes the index a rule and not a lock.
        claim("m-2", "https://b.example");
        expect(store.all("SELECT COUNT(*) AS n FROM merchant_origins")).toEqual([{ n: 2 }]);
      } finally {
        store.close();
      }
    });

    it("accepts an administration entry with no merchant, and two identical ones", () => {
      // `merchant_id` is the first nullable column of this schema, and the absence **means** something:
      // an action of the platform and not of a merchant. And the log is append-only with no business
      // key, so two identical actions are two actions — same decision as `received_events`.
      withMigrationsUpTo(4);
      const store = openSqliteStore({ file, migrations: schema });
      try {
        const entry = (merchant: string | null): void => {
          store.run(
            "INSERT INTO admin_entries (merchant_id, document) VALUES (:m, '{}')",
            merchant === null ? { m: null } : { m: merchant },
          );
        };
        entry(null);
        entry(null);
        entry("m-1");
        expect(store.all("SELECT COUNT(*) AS n FROM admin_entries")).toEqual([{ n: 3 }]);
        expect(store.all("SELECT COUNT(*) AS n FROM admin_entries WHERE merchant_id = 'm-1'")).toEqual([
          { n: 1 },
        ]);
      } finally {
        store.close();
      }
    });

    it("accumulates a diagnostic on its key instead of writing a second row", () => {
      // The count is a column and the store increments it, because doing it by reading and writing is
      // another race. The key is the one the port upserts on, **version included**: a report that says
      // which configuration it had loaded is a different row from one that does not, and `0` is what the
      // schema uses for "not said" — a nullable column would make every versionless report its own row,
      // because a unique index of SQLite treats NULLs as distinct.
      withMigrationsUpTo(4);
      const store = openSqliteStore({ file, migrations: schema });
      try {
        const seen = (anchor: string, surface: string, version = 0): void => {
          store.run(
            `INSERT INTO anchor_diagnostics
               (merchant_id, anchor, surface, configuration_version, count, document)
             VALUES ('m-1', :anchor, :surface, :version, 1, '{}')
             ON CONFLICT (merchant_id, anchor, surface, configuration_version)
               DO UPDATE SET count = count + 1`,
            { anchor, surface, version },
          );
        };
        seen("variant_selector", "product");
        seen("variant_selector", "product");
        seen("variant_selector", "cart");
        seen("variant_selector", "product", 3);
        expect(
          store.all(
            `SELECT anchor, surface, configuration_version AS version, count
             FROM anchor_diagnostics ORDER BY surface, version`,
          ),
        ).toEqual([
          { anchor: "variant_selector", surface: "cart", version: 0, count: 1 },
          { anchor: "variant_selector", surface: "product", version: 0, count: 2 },
          { anchor: "variant_selector", surface: "product", version: 3, count: 1 },
        ]);
      } finally {
        store.close();
      }
    });
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
