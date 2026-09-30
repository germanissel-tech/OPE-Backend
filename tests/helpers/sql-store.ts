// The double of `SqlStore` a unit test builds a durable gateway on, written once.
//
// **It exists because the vocabulary grew** (feature 034): a store now also opens a unit of work, hands
// out turns and says whether it is busy, and there were two doubles written by hand — one in the merchant
// gateway's test, one in the experiment's. Three members times every double is the kind of edit that ends
// with two doubles that disagree about what a store does, which is exactly what a double must not do.
//
// What it is **not**: a store. It answers rows a test decided, records what it was asked, and refuses when
// the test says so. Anything that needs a store that behaves lives in `tests/durability/`, against a real
// one, because that is the only place where the behaviour is the store's and not this file's.
import type { Logger } from "../../src/application/shared-kernel/index.js";
import type { SqlParams, SqlRow, SqlStore } from "../../src/interface-adapters/shared-kernel/index.js";

export interface FakeStoreOptions {
  /** What every read answers, as documents: the gateway parses them like it parses the real ones. */
  readonly rows?: readonly string[];
  /** Whether every write throws, which is how a refused write reaches the failure channel of a port. */
  readonly refuses?: boolean;
  /** Whether a unit of work is open elsewhere, which is what the queue of the register asks. */
  readonly busy?: boolean;
}

export interface FakeStore {
  readonly store: SqlStore;
  /** The statements the gateway asked for, in order: how "it did not read the table again" is checked. */
  readonly statements: readonly string[];
  /** The parameters of each statement, for the assertions that are about what was written. */
  readonly params: readonly (SqlParams | undefined)[];
  /** How many turns were waited for: what tells a gateway that respects the unit from one that does not. */
  readonly turns: () => number;
  /** Only the reads, which is the count a test of the in-memory index asserts. */
  readonly reads: () => number;
}

export interface FakeLogger {
  readonly logger: Logger;
  readonly entries: readonly { fields: Record<string, unknown>; message: string }[];
}

/** A store that answers `rows`, records what it was asked, and refuses every write when told to. */
export function fakeStore(options: FakeStoreOptions = {}): FakeStore {
  const statements: string[] = [];
  const params: (SqlParams | undefined)[] = [];
  let turns = 0;
  const asked = (sql: string, given?: SqlParams): void => {
    statements.push(sql);
    params.push(given);
  };
  const store: SqlStore = {
    all: (sql, given) => {
      asked(sql, given);
      return (options.rows ?? []).map((document): SqlRow => ({ document }));
    },
    run: (sql, given) => {
      asked(sql, given);
      if (options.refuses === true) throw new Error("the fake store refuses every write");
    },
    transaction: (work) => work(),
    scope: async (work) => {
      const outcome = await work(() => undefined);
      return { ok: true, value: outcome };
    },
    enter: () => {
      turns += 1;
      return Promise.resolve();
    },
    committed: (after) => {
      after();
    },
    busy: () => options.busy === true,
    close: () => undefined,
  };
  return {
    store,
    statements,
    params,
    turns: () => turns,
    reads: () => statements.filter((sql) => sql.trimStart().startsWith("SELECT")).length,
  };
}

/** A logger that keeps what it was told: a degraded write says why exactly there (ADR-021). */
export function fakeLogger(): FakeLogger {
  const entries: { fields: Record<string, unknown>; message: string }[] = [];
  const keep = (fields: Record<string, unknown>, message: string): void => {
    entries.push({ fields, message });
  };
  return { logger: { info: keep, warn: keep, error: keep }, entries };
}
