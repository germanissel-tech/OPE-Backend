// The store itself: the schema it applies, the schema it refuses, and the file that outlives the
// process that wrote it. Everything else in this suite is about a port; this one is about the
// floor they all stand on, so when a gateway test fails it is not the first suspect.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openSqliteStore } from "../../src/infrastructure/sqlite/open-store.js";

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

  it("says so when the build has no migration to apply", () => {
    const empty = mkdtempSync(path.join(tmpdir(), "ope-no-migrations-"));
    writeFileSync(path.join(empty, "notes.txt"), "not a migration");
    try {
      expect(() => openSqliteStore({ file, migrations: empty })).toThrow(/no schema to apply/);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });
});
