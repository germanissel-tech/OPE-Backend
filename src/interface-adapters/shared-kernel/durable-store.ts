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
import type { SqlStore } from "./sql-store.js";
import type { Logger } from "../../application/shared-kernel/index.js";

export interface DurableGatewayDeps {
  readonly store: SqlStore;
  readonly logger: Logger;
}

/**
 * Runs `work` against the store and gives back its value, or the failure the port declares.
 *
 * The work is **synchronous** —SQLite is— and the promise is only the shape the port asks for: nothing
 * here defers the write to a later tick, which would make the order of records unpredictable and hide
 * the degradation this function exists to report (feature 030, research R-03).
 *
 * The cause is **logged and not carried**: the failure channel says "nothing was written", which is what
 * the caller needs to fail closed and what is not enough to diagnose — a full disk, a lost permission and
 * a schema that drifted look the same without that line.
 */
export function tried<T, E extends DomainError>(
  deps: DurableGatewayDeps,
  what: string,
  work: () => T,
  failure: () => E,
): Promise<Result<T, E>> {
  try {
    return Promise.resolve(ok(work()));
  } catch (cause) {
    deps.logger.error(
      { write: what, cause: cause instanceof Error ? cause.message : String(cause) },
      "The durable store refused a write; nothing was recorded.",
    );
    return Promise.resolve(fail(failure()));
  }
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
