// What every durable gateway shares: what it is given, and how a refused write becomes a value.
//
// **It lives here and not with the ledger, and that was the context map's call.** It was written for the
// decision ledger (feature 030) and stayed there while only the ledger's neighbours needed it. Feature
// 033 made the merchant store durable, and `merchant` may not depend on `ledger` — rightly, it has
// nothing to do with it. So what is shared moved to the kernel of this ring, where `SqlStore` and the
// document codec already were, and the ledger keeps only the wrapper that names **its** failure.
//
// **Only writes go through here, because only writes have somewhere to report to**: every `record` of
// ADR-021 returns a `Result` and every `find` returns the record or nothing. A read that fails therefore
// throws, and that is not an oversight — giving reads a failure channel is a change of every port and is
// the part of the `persistence-and-resilience` milestone still open. Feature 032 brought it forward in
// the three reads that needed it (`PastActivity`), and said so there.
import {
  StoreUnavailable,
  type DomainError,
  fail,
  ok,
  type Result,
} from "../../domain/shared-kernel/index.js";
import { descending, pageTo } from "./paging.js";
import type { SqlParams, SqlRow, SqlStore } from "./sql-store.js";
import type { Logger, Page, PageQuery } from "../../application/shared-kernel/index.js";

export interface DurableGatewayDeps {
  readonly store: SqlStore;
  readonly logger: Logger;
}

/**
 * Runs `work` against the store and gives back its value, or the failure the port declares.
 *
 * **It waits its turn first, and that is the one line that gives every write of every durable gateway
 * the unit of work of feature 034.** The three wrappers of this ring funnel here, so a write cannot land
 * inside somebody else's open transaction — and a gateway does not have to remember anything. Outside a
 * unit the turn is already granted and costs a microtask.
 *
 * The work itself is still **synchronous** —SQLite is— and nothing here defers it to a later tick, which
 * would make the order of records unpredictable and hide the degradation this function exists to report
 * (feature 030, research R-03). Waiting for a turn is not deferring the write: the turn is granted in the
 * order it was asked for, so two records still land in the order they were called.
 *
 * The cause is **logged and not carried**: the failure channel says "nothing was written", which is what
 * the caller needs to fail closed and what is not enough to diagnose — a full disk, a lost permission and
 * a schema that drifted look the same without that line.
 */
export async function tried<T, E extends DomainError>(
  deps: DurableGatewayDeps,
  what: string,
  work: () => T,
  failure: () => E,
): Promise<Result<T, E>> {
  await deps.store.enter();
  try {
    return ok(work());
  } catch (cause) {
    deps.logger.error(
      { write: what, cause: cause instanceof Error ? cause.message : String(cause) },
      "The durable store refused a write; nothing was recorded.",
    );
    return fail(failure());
  }
}

/**
 * The same turn for a **read**, which needs its own because reads do not go through the wrappers above.
 *
 * A read inside somebody else's open transaction sees what that transaction has not committed: a decision
 * could count a merchant that is about to disappear. So it waits, and what it reads is a store that is
 * nobody's halfway state.
 *
 * **A read that fails still throws**, unlike a write: every `find` of ADR-021 answers the record or
 * nothing, and giving reads a failure channel is a change of every port that the milestone still owes.
 */
export async function fetched<T>(deps: DurableGatewayDeps, read: () => T): Promise<T> {
  await deps.store.enter();
  return read();
}

/**
 * For the ports whose failure is `StoreUnavailable` — what an operator writes (feature 033). Two names
 * and not one because the two errors mean different things to whoever reads them: a decision degraded
 * because the **ledger** could not accept it is not the same fact as an administration action refused
 * because the **store** could not.
 */
export function stored<T>(
  deps: DurableGatewayDeps,
  what: string,
  work: () => T,
): Promise<Result<T, StoreUnavailable>> {
  return tried(deps, what, work, () => new StoreUnavailable());
}

/**
 * A page of a versioned history, newest first, resuming **below** the version the cursor names: the key
 * of a row never moves when a version is added, so the page is stable while somebody publishes.
 *
 * It exists because the third store with a numbered history arrived (feature 038, D-34): the merchant
 * configurations, the levels of the release and the texts page their versions the same way, and three
 * copies of the window and the cursor were the duplication the gate refused. What varies —the statement,
 * what identifies the history, how a row becomes an item— arrives; what is the same stays here.
 */
export function pagedByVersion<T>(
  deps: DurableGatewayDeps,
  history: VersionedHistory<T>,
  query: PageQuery,
): Promise<Page<T>> {
  const window = descending(query);
  return fetched(deps, () =>
    pageTo(
      deps.store
        .all(history.sql, { ...history.params, below: window.below, limit: window.limit })
        .map((row) => ({ key: Number(row[VERSION]), item: history.itemOf(row) })),
      window,
    ),
  );
}

/** What identifies one versioned history: the statement, what names it, and how a row becomes an item. */
export interface VersionedHistory<T> {
  /** Selects `version` and the document, with `:below` and `:limit` where the window goes. */
  readonly sql: string;
  readonly params: SqlParams;
  readonly itemOf: (row: SqlRow) => T;
}

/** The column every versioned history numbers its rows by. */
const VERSION = "version";
