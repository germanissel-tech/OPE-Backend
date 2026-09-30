// The unit of work of the store (feature 034), against a real one — which is the only place it can be
// tested, because everything it promises is about what happens when something fails in the middle.
//
// **Three things, and the third is the one that keeps the other two honest**: what a unit that aborts
// wrote does not remain; what a unit that closes wrote does; and **a write that did not wait its turn
// throws** instead of landing inside somebody else's transaction. Without the third, the first two are
// true only for the code that remembers.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { restartableStore, type Restartable } from "./store-fixture.js";
import type { SqlStore } from "../../src/interface-adapters/shared-kernel/index.js";

/** A row of a table with no business key, so an insert is only an insert. */
const INSERT = `INSERT INTO admin_entries (merchant_id, document) VALUES (:merchant, '{}')`;
const CLAIM_ORIGIN = `INSERT INTO merchant_origins (merchant_id, origin) VALUES (:merchant, :origin)`;
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

/**
 * **Two gateways that differ by one line**, written for SC-005 and for nothing else.
 *
 * The story this pair is about: whoever adds a durable store to this system has one more thing to do, and
 * if they forget it their first test fails instead of their gateway writing inside somebody else's
 * transaction. The pair is what makes the point — the same component, the same write, and the only
 * difference is the turn — and it is written by hand rather than through `stored`/`fetched` precisely
 * because those wrappers already wait: what is under test is what happens to somebody who does not use
 * them.
 */
const forgetfulGateway = (store: SqlStore) => ({
  // The mistake, and it is the whole component: no `await store.enter()` before touching the store.
  write: async (merchant: string): Promise<void> => {
    store.run(INSERT, { merchant });
  },
});

const carefulGateway = (store: SqlStore) => ({
  write: async (merchant: string): Promise<void> => {
    await store.enter();
    store.run(INSERT, { merchant });
  },
});

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
    }).toThrow("did not wait its turn");
    expect(() => fixture.store.all(COUNT, { merchant: "intruder" })).toThrow("did not wait its turn");

    await unit;
    // And with no unit open it costs nothing and changes nothing.
    expect(() => {
      fixture.store.run(INSERT, { merchant: "intruder" });
    }).not.toThrow();
    expect(rows("intruder")).toBe(1);
  });

  it("reverts everything when the work throws, and lets the throw out", async () => {
    // A throw is not `abort()`: `abort` is the caller saying "revert this on purpose", and a throw is a
    // programming error. The unit reverts either way —half a unit is the one thing it must never leave—
    // but only the first is a failure it reports; the second travels as what it is.
    const attempt = fixture.store.scope(async () => {
      fixture.store.run(INSERT, { merchant: "thrown" });
      await tick();
      throw new Error("something nobody planned for");
    });

    await expect(attempt).rejects.toThrow("something nobody planned for");
    expect(rows("thrown")).toBe(0);
    // And the store is usable afterwards, which is what says the transaction was really closed.
    fixture.store.run(INSERT, { merchant: "after" });
    expect(rows("after")).toBe(1);
  });

  it("reverts only the inner transaction when a statement inside the unit fails", async () => {
    // **The savepoint.** A gateway wraps its own decision in `transaction`, and inside a unit that is a
    // savepoint: a write that fails halfway has to undo **its** part and leave the rest of the unit
    // standing, because the gateway turns that failure into the value its port declares and the caller
    // keeps going. Without the savepoint the half-written row would ride along to the commit.
    const unit = await fixture.store.scope(async () => {
      fixture.store.run(INSERT, { merchant: "before" });
      await tick();
      const refused = (): void => {
        fixture.store.transaction(() => {
          fixture.store.run(INSERT, { merchant: "half" });
          // A statement the schema refuses: `merchant_origins.origin` is unique, so the second claim of
          // the same origin throws exactly the way a gateway's does.
          fixture.store.run(CLAIM_ORIGIN, { merchant: "half", origin: "https://taken.example" });
          fixture.store.run(CLAIM_ORIGIN, { merchant: "half", origin: "https://taken.example" });
        });
      };
      expect(refused).toThrow();
      fixture.store.run(INSERT, { merchant: "after" });
      return "kept";
    });

    expect(unit).toEqual({ ok: true, value: "kept" });
    fixture.restart();
    // The two writes outside the inner transaction are there; nothing of the one that failed is.
    expect(rows("before")).toBe(1);
    expect(rows("after")).toBe(1);
    expect(rows("half")).toBe(0);
  });

  it("throws **its own** error when a transaction is opened without waiting its turn", async () => {
    // The guard is on the transaction too, and it has to be: a gateway that forgot its turn would write
    // inside somebody else's unit, which is the same defect one level up.
    //
    // **And the assertion is on the message, which is not fussiness.** The mutation gate survived a
    // version of this file with the guard removed: SQLite throws there anyway —"cannot start a
    // transaction within a transaction"— so a test that only asked for *a* throw could not tell a guard
    // that works from no guard at all. What it has to say is which mistake was made, because that is the
    // whole reason the guard exists.
    const unit = fixture.store.scope(async () => {
      await tick();
      await tick();
      return undefined;
    });
    await tick();

    // **The work is empty on purpose.** With a statement inside, the statement's own guard throws the same
    // error and the assertion cannot tell which of the two fired — which is exactly how a version with no
    // guard on the transaction passed this file. Empty, only the transaction can be the one refusing.
    expect(() => {
      fixture.store.transaction(() => undefined);
    }).toThrow("did not wait its turn");

    // And with a statement inside, nothing of it lands either.
    expect(() => {
      fixture.store.transaction(() => {
        fixture.store.run(INSERT, { merchant: "intruder" });
      });
    }).toThrow("did not wait its turn");

    await unit;
    expect(rows("intruder")).toBe(0);
  });

  it("runs what was left for the commit only when the unit commits, and at once when there is none", async () => {
    // What `committed` is for: memory that mirrors the store — the in-memory index of ADR-041 — must not
    // change while a unit is open, because a reverted action would leave it holding what the table never
    // got. Outside a unit there is nothing to wait for and it runs immediately.
    const done: string[] = [];
    fixture.store.committed(() => done.push("no unit"));
    expect(done).toEqual(["no unit"]);

    const reverted = await fixture.store.scope(async (abort) => {
      fixture.store.committed(() => done.push("reverted"));
      await tick();
      abort();
      return undefined;
    });
    expect(reverted.ok).toBe(false);
    expect(done).toEqual(["no unit"]);

    await fixture.store.scope(async () => {
      fixture.store.committed(() => done.push("committed"));
      await tick();
      // Not yet: the store has not committed, so what mirrors it has not changed either.
      expect(done).toEqual(["no unit"]);
      return undefined;
    });
    expect(done).toEqual(["no unit", "committed"]);
  });

  it("fails the first write of a gateway that forgot its turn, and costs that gateway nothing with no unit open", async () => {
    // **SC-005, and the two halves are one case on purpose.** Only the first half, and a guard that
    // refused everything would pass; only the second, and a guard that protects nothing would. What has to
    // be true is both: it fails where writing would be wrong, and it is free where it would not.
    const forgetful = forgetfulGateway(fixture.store);
    const careful = carefulGateway(fixture.store);

    const unit = fixture.store.scope(async () => {
      await tick();
      await tick();
      return undefined;
    });
    await tick();

    await expect(forgetful.write("forgot")).rejects.toThrow("did not wait its turn");
    // The careful one is the same component with one line more: it **waits** rather than failing, which is
    // what says the guard is not simply a wall around an open unit.
    const waiting = careful.write("waited");
    await unit;
    await waiting;

    expect(rows("forgot")).toBe(0);
    expect(rows("waited")).toBe(1);

    // And with nothing open, the forgetful one writes: whoever never opens a unit pays nothing for this.
    await forgetful.write("forgot");
    expect(rows("forgot")).toBe(1);
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
