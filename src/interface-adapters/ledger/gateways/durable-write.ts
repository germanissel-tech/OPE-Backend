// How a durable gateway answers when the store will not accept (ADR-021, constitution II). It
// lives in the ledger module because `LedgerUnavailable` does, and the other modules whose
// gateways went durable —outcomes, experiment, catalog— reach it through this module's `index.ts`,
// which the context map already allows them.
//
// **The failure is logged before it is swallowed.** The port's failure channel says "nothing was
// recorded" and no more, which is exactly what the decision plane needs to fail closed — and
// exactly not enough for whoever has to find out why. A full disk, a file that lost its
// permissions and a schema that drifted all look the same from the outside; the one line written
// here is the only place they do not.
import { LedgerUnavailable } from "../../../domain/ledger/index.js";
import { fail, ok, type Result } from "../../../domain/shared-kernel/index.js";
import type { Logger } from "../../../application/shared-kernel/index.js";
import type { SqlStore } from "../../shared-kernel/index.js";

/** What every durable gateway is built with: where to write, and where to say it could not. */
export interface DurableGatewayDeps {
  readonly store: SqlStore;
  readonly logger: Logger;
}

/**
 * Only **writes** go through here, because only writes have somewhere to report to: every `record`
 * of ADR-021 returns a `Result` and every `find` returns the record or nothing. A read that fails
 * therefore throws, and that is not an oversight of this file — giving reads a failure channel is
 * a change of every port and is the part of the `persistence-and-resilience` milestone this
 * feature deliberately left out.
 *
 * Runs `work` against the store and gives back its value, or the ledger's failure. The work is
 * synchronous —SQLite is— and the promise is only the shape the port asks for: nothing here
 * defers the write to a later tick, which would make the order of records unpredictable and hide
 * the degradation this function exists to report (research R-03).
 */
export function attempted<T>(
  deps: DurableGatewayDeps,
  what: string,
  work: () => T,
): Promise<Result<T, LedgerUnavailable>> {
  try {
    return Promise.resolve(ok(work()));
  } catch (failure) {
    deps.logger.error(
      { write: what, cause: failure instanceof Error ? failure.message : String(failure) },
      "The durable store refused a write; nothing was recorded.",
    );
    return Promise.resolve(fail(new LedgerUnavailable()));
  }
}
