// What a durable gateway writes against. The ring may not import `infrastructure/`, and a gateway
// takes drivers only from there (ADR-013), so the vocabulary lives here and the engine that speaks
// it lives in `infrastructure/sqlite/`: the gateway receives one of these through its binding and
// never learns which engine answered.
//
// It is **synchronous**, because the SQLite of the standard library is (research R-03 of feature
// 030). Wrapping a statement in `setImmediate` to look asynchronous would not make it so: it would
// only make the order of writes unpredictable and hide the degradation of ADR-021 behind a tick.
// A gateway wraps the result in a `Promise` and the port keeps its shape.
//
// A failed statement **throws**, and that is deliberate: a store that cannot accept is not a
// business error of the domain but a fault of the machine, and translating it into the failure
// channel of its port is precisely the gateway's job (`attempted`, in the ledger module).
import type { Result, StoreUnavailable } from "../../domain/shared-kernel/index.js";

/** What a statement takes and returns. Dates travel as ISO strings and documents as JSON text. */
export type SqlValue = string | number | null;

export type SqlRow = Readonly<Record<string, SqlValue>>;

/** Named parameters of a statement, written `:name` in the SQL. */
export type SqlParams = Readonly<Record<string, SqlValue>>;

export interface SqlStore {
  /**
   * The rows of a query, in the order the SQL asked for.
   *
   * **Throws if a unit of work of somebody else is open** (feature 034): a read inside another's
   * transaction sees what that transaction has not committed, so waiting for the turn is not politeness.
   */
  all(sql: string, params?: SqlParams): readonly SqlRow[];
  /** A statement that returns nothing: an insert, an update, a delete. Same guard as `all`. */
  run(sql: string, params?: SqlParams): void;
  /**
   * Runs `work` as one transaction, rolling back if it throws. It is what lets a port decide
   * first / repeat / conflict **without an asynchronous step between the check and the write**
   * (01 §6): the whole decision happens inside one call and nothing interleaves.
   */
  transaction<T>(work: () => T): T;
  /**
   * Runs `work` as **one unit**, which is the same transaction seen from an asynchronous caller: what it
   * wrote is committed when the work resolves and reverted when it calls `abort` (feature 034, D-28).
   *
   * **The work receives `abort` instead of throwing**, and that is what lets the unit be opened from
   * `application/`, where `try/catch` is forbidden (ADR-023) and where an exception would become a `500`
   * rather than the `503` the failure already declares. The failure travels as a value, and the throw
   * that actually reverts stays here.
   *
   * While a unit is open, every other access **waits its turn**: that is what `enter` is for.
   */
  scope<T>(work: (abort: () => void) => Promise<T>): Promise<Result<T, StoreUnavailable>>;
  /**
   * The permission to touch the store: it resolves at once unless a unit of work of **somebody else** is
   * open, and then when that unit closes. Inside its own unit it resolves at once — getting that wrong is
   * a deadlock and not a wrong answer.
   */
  enter(): Promise<void>;
  /**
   * Runs `after` when the open unit commits — or **now**, when there is no unit open.
   *
   * It exists for the one thing a transaction cannot revert: **memory that mirrors the store**. The
   * merchants and the experiments answer their reads from an in-memory index (ADR-041) whose rule is that
   * it holds what the store accepted, and inside an open unit nothing is accepted yet. Without this, an
   * action that reverted would leave the index holding a merchant the table does not have — the one
   * divergence that gateway's design says cannot happen.
   *
   * Whoever registers work here is saying "this is not part of the transaction and it only makes sense
   * once the transaction is real". Nothing that has to be atomic belongs here.
   */
  committed(after: () => void): void;
  /**
   * Whether a unit of work is open right now, **answered synchronously**.
   *
   * It exists for the one caller that cannot wait for anything: the queue of the event register flushes
   * synchronously and its `record` returns `void` on purpose, so that nobody can wait for a measurement
   * to be written (ADR-039). An `await` there would be a regression of principle IV dressed up as
   * tidiness — so the queue asks instead, keeps what is pending and writes it on the next interval.
   */
  busy(): boolean;
  /** Releases the file. The durability suite reopens a store to prove a restart keeps what was written. */
  close(): void;
}
