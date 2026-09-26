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

/** What a statement takes and returns. Dates travel as ISO strings and documents as JSON text. */
export type SqlValue = string | number | null;

export type SqlRow = Readonly<Record<string, SqlValue>>;

/** Named parameters of a statement, written `:name` in the SQL. */
export type SqlParams = Readonly<Record<string, SqlValue>>;

export interface SqlStore {
  /** The rows of a query, in the order the SQL asked for. */
  all(sql: string, params?: SqlParams): readonly SqlRow[];
  /** A statement that returns nothing: an insert, an update, a delete. */
  run(sql: string, params?: SqlParams): void;
  /**
   * Runs `work` as one transaction, rolling back if it throws. It is what lets a port decide
   * first / repeat / conflict **without an asynchronous step between the check and the write**
   * (01 §6): the whole decision happens inside one call and nothing interleaves.
   */
  transaction<T>(work: () => T): T;
  /** Releases the file. The durability suite reopens a store to prove a restart keeps what was written. */
  close(): void;
}
