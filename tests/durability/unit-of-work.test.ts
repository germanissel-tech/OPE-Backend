// The unit of work of the store (feature 034), against a real one — which is the only place it can be
// tested, because everything it promises is about what happens when something fails in the middle.
//
// **Three things, and the third is the one that keeps the other two honest**: what a unit that aborts
// wrote does not remain; what a unit that closes wrote does; and **a write that did not wait its turn
// throws** instead of landing inside somebody else's transaction. Without the third, the first two are
// true only for the code that remembers.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { restartableStore, type Restartable } from "./store-fixture.js";

/** A row of a table with no business key, so an insert is only an insert. */
const INSERT = `INSERT INTO admin_entries (merchant_id, document) VALUES (:merchant, '{}')`;
const COUNT = `SELECT COUNT(*) AS n FROM admin_entries WHERE merchant_id = :merchant`;

/** Yields to the event loop, which is where everything this file is about happens. */
const tick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

let fixture: Restartable;

beforeEach(() => {
  fixture = restartableStore();
});

afterEach(() => {
  fixture.dispose();
});

const rows = (merchant: string): number => Number(fixture.store.all(COUNT, { merchant })[0]?.["n"] ?? -1);

describe("the unit of work of the store", () => {
  it("keeps what a unit that closes wrote, across a restart", async () => {
    const unit = await fixture.store.scope(async () => {
      fixture.store.run(INSERT, { merchant: "kept" });
      // An await inside the unit is the whole point: a synchronous transaction could not hold one.
      await tick();
      fixture.store.run(INSERT, { merchant: "kept" });
      return "done";
    });

    expect(unit).toEqual({ ok: true, value: "done" });
    fixture.restart();
    expect(rows("kept")).toBe(2);
  });

  it("leaves nothing of what a unit that aborts wrote", async () => {
    // The reason the feature exists: the second write is the one that fails in the real case — the audit
    // entry — and what has to disappear is the first, which had already been accepted.
    const unit = await fixture.store.scope(async (abort) => {
      fixture.store.run(INSERT, { merchant: "gone" });
      await tick();
      abort();
      return "unreachable";
    });

    expect(unit.ok).toBe(false);
    expect(unit.ok ? undefined : unit.error.code).toBe("store-unavailable");
    expect(rows("gone")).toBe(0);
    fixture.restart();
    expect(rows("gone")).toBe(0);
  });

  it("leaves the store writable after a unit, whichever way it ended", async () => {
    await fixture.store.scope(async (abort) => {
      fixture.store.run(INSERT, { merchant: "first" });
      await tick();
      abort();
      return undefined;
    });

    // If a reverted unit left the transaction open, this would throw or land inside it.
    fixture.store.run(INSERT, { merchant: "second" });
    expect(rows("second")).toBe(1);

    const again = await fixture.store.scope(async () => {
      fixture.store.run(INSERT, { merchant: "third" });
      return undefined;
    });
    expect(again.ok).toBe(true);
    expect(rows("third")).toBe(1);
  });

  it("says it is busy while a unit is open, and answers that synchronously", async () => {
    // Synchronously because the queue of the event register cannot await anything: its `flush` is
    // synchronous on purpose so nobody can wait for the register's write (ADR-039).
    expect(fixture.store.busy()).toBe(false);

    const unit = fixture.store.scope(async () => {
      await tick();
      return undefined;
    });
    await tick();
    expect(fixture.store.busy()).toBe(true);

    await unit;
    expect(fixture.store.busy()).toBe(false);
  });

  it("makes a turn wait while a unit is open, and hands it out at once when there is none", async () => {
    // Outside a unit the turn costs nothing, which is what keeps this off the critical path when nobody
    // is auditing anything.
    let immediate = false;
    await fixture.store.enter().then(() => {
      immediate = true;
    });
    expect(immediate).toBe(true);

    const unit = fixture.store.scope(async () => {
      await tick();
      await tick();
      return undefined;
    });
    await tick();

    let arrived = false;
    const turn = fixture.store.enter().then(() => {
      arrived = true;
    });
    await tick();
    // The unit is still open: whoever asked for a turn is still waiting, and that is the whole
    // mechanism — it waits instead of writing inside somebody else's transaction.
    expect(arrived).toBe(false);

    await unit;
    await turn;
    expect(arrived).toBe(true);
  });

  it("throws when somebody writes or reads without waiting its turn", async () => {
    // **The guard**, and it is what makes a forgotten turn a failed test instead of a defect that only
    // shows up when something else fails. It is a programming error, so it throws (ADR-023).
    const unit = fixture.store.scope(async () => {
      await tick();
      await tick();
      return undefined;
    });
    await tick();

    expect(() => {
      fixture.store.run(INSERT, { merchant: "intruder" });
    }).toThrow();
    expect(() => fixture.store.all(COUNT, { merchant: "intruder" })).toThrow();

    await unit;
    // And with no unit open it costs nothing and changes nothing.
    expect(() => {
      fixture.store.run(INSERT, { merchant: "intruder" });
    }).not.toThrow();
    expect(rows("intruder")).toBe(1);
  });

  it("lets the owner of the unit write and read inside it", async () => {
    // The other half of the guard: the one that opened the unit is not a stranger to it. Getting this
    // wrong is a deadlock, not a wrong answer, which is why it has its own case.
    const unit = await fixture.store.scope(async () => {
      fixture.store.run(INSERT, { merchant: "owner" });
      await fixture.store.enter();
      // Its own writes are visible to it before the unit closes, which is what a transaction means.
      return rows("owner");
    });

    expect(unit).toEqual({ ok: true, value: 1 });
  });
});
