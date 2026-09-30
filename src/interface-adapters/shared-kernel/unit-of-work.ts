// The two ways of keeping the promise of `UnitOfWork` (feature 034): over a durable store, and over a
// deployment that keeps nothing in common.
//
// **They are two lines each, and the whole design is in that.** The store already knows how to hold a
// transaction across an `await` — that is `scope` in `SqlStore` — so this file only says which of the two
// the deployment has. Everything that makes the mechanism work (the turn, the guard, the `BEGIN` that is
// not deferred) lives in `infrastructure/sqlite/open-store.ts`, where the technology belongs (ADR-013).
import { StoreUnavailable, fail, ok } from "../../domain/shared-kernel/index.js";
import type { SqlStore } from "./sql-store.js";
import type { UnitOfWork } from "../../application/shared-kernel/index.js";

/** The unit of work of the durable deployment: the store's own, handed on. */
export const durableUnitOfWork = (store: SqlStore): UnitOfWork => ({ scope: (work) => store.scope(work) });

/**
 * The unit of work of a deployment that keeps nothing durable: it runs the work and **cannot revert**.
 *
 * **It still reports the abort as the failure of the unit, and that half is not optional.** The first
 * version of this file answered `ok` whatever happened, and the integration suite caught it in the way
 * that mattered: creating a merchant with a refusing trail answered `201`. The caller was told the action
 * succeeded when nothing had audited it — which is the one thing ADR-034's amendment exists to prevent, so
 * "cannot revert" must not become "cannot tell".
 *
 * What it genuinely cannot do is undo: the ledgers here are maps in this process, they do not survive a
 * restart, and the inventory of feature 033 classifies them as such. So in this deployment an aborted
 * action **is reported and not reverted**, and the guarantee of atomicity is the durable deployment's —
 * which is where its test lives.
 */
export const transientUnitOfWork = (): UnitOfWork => ({
  scope: async (work) => {
    const reverting = { asked: false };
    const value = await work(() => {
      reverting.asked = true;
    });
    return reverting.asked ? fail(new StoreUnavailable()) : ok(value);
  },
});
