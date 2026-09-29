// The deduplication window rebuilt from the register (feature 033, US3). **Recoverable, not durable**,
// which was the owner's decision: the `claim` keeps being answered from memory — a `Map.get` on the path
// of every batch — and what a restart loses is rebuilt from what is durable the first time each merchant
// appears.
//
// **Where the hook is.** `claim(merchantId, ids)` is the only method of the port, and it is the one place
// where "this merchant appeared for the first time since the start" can be noticed without anybody else
// having to know. So the rebuild lives here, once per merchant and per boot, and the rest of the system
// keeps talking to an in-memory window.
//
// **The bounds are the window's own.** It asks for the ids of the last `ttlMs` and at most `maxIds` of
// them, because that is what the window keeps: a rebuild that read more would hand back a window larger
// than the one the platform publishes — a different promise, arrived at by accident rather than decided.
//
// **A read that fails does not stop the ingest**, and that is the property this file is really about.
// Degrading an ingest because a *measurement* could not be read is the mixing `01 §P9` exists to
// prevent: the trade would be a duplicate counted twice — a dirty figure — against a batch of events
// lost. It is logged and the claim is answered.
//
// **What it is worth is what the register is worth.** If the register is missing a stretch (feature 031,
// FR-018), an event of that stretch can count as new again. Same asymmetry as ADR-040: what protects a
// cap is exact, what improves a measurement is best-effort, and deduplication is measurement — a
// duplicate counted twice dirties a figure, it does not spend a budget.
//
// **And one deviation, declared.** The window stores the instant an id was *claimed*, so a rebuilt id
// lives a full `ttlMs` from the restart rather than from its arrival: for those ids the window can reach
// almost twice its length. Bounded — only ids that arrived inside the last `ttlMs`, only until they
// expire — and on the side that dirties a figure rather than the side that spends a cap. Fixing it would
// mean carrying the arrival instant through `EventDedup.claim`, which is a change of an application port
// for the benefit of a rebuild.
import type { DedupWindow, EventDedup, EventLog } from "../../../application/ingestion/index.js";
import type { Clock, Logger } from "../../../application/shared-kernel/index.js";
import type { EventId } from "../../../domain/ingestion/index.js";
import type { MerchantId } from "../../../domain/shared-kernel/index.js";

export interface RecoveringEventDedupDeps {
  /** The window that answers, **injected and not imported**: a gateway does not import a gateway (ADR-013). */
  readonly dedup: EventDedup;
  /** What the rebuild reads. In the durable deployment this is the register behind its queue. */
  readonly register: EventLog;
  readonly clock: Clock;
  readonly window: DedupWindow;
  readonly logger: Logger;
}

export function recoveringEventDedup(deps: RecoveringEventDedupDeps): EventDedup {
  const { dedup, register, clock, window, logger } = deps;
  /**
   * The rebuild of each merchant, kept as the promise itself rather than as a flag.
   *
   * **A flag set on entry would be wrong and a flag set on completion would be worse**: two batches of
   * one merchant that interleave would, with the first, let the second claim before the rebuild landed,
   * and with the second both read. Sharing the promise makes the second batch wait for the same rebuild
   * the first started, which is the only shape where the window is complete before anything is claimed.
   */
  const rebuilds = new Map<MerchantId, Promise<void>>();

  const recover = async (merchantId: MerchantId): Promise<void> => {
    const since = new Date(clock.now().getTime() - window.ttlMs);
    try {
      const recent = await register.idsSince(merchantId, since, window.maxIds);
      // Oldest first, because the register answers most recent first and the window evicts the oldest
      // **entered**: claiming them in the order received would make the cap keep the oldest ids and
      // forget the newest, which is the opposite of what the window promises.
      await dedup.claim(merchantId, [...recent].reverse());
    } catch (cause) {
      logger.warn(
        { merchantId, cause: cause instanceof Error ? cause.message : String(cause) },
        "The deduplication window could not be rebuilt for this merchant; events received before the restart may count as new.",
      );
    }
  };

  const rebuilt = (merchantId: MerchantId): Promise<void> => {
    const started = rebuilds.get(merchantId);
    if (started !== undefined) return started;
    // `recover` never rejects, so what is memoised is a promise nobody has to guard — and a failed read
    // is not tried again, which on the path of every batch is the difference between a store that is
    // down costing one read and costing one per batch.
    const rebuilding = recover(merchantId);
    rebuilds.set(merchantId, rebuilding);
    return rebuilding;
  };

  return {
    claim: async (merchantId: MerchantId, eventIds: readonly EventId[]): Promise<ReadonlySet<EventId>> => {
      await rebuilt(merchantId);
      return dedup.claim(merchantId, eventIds);
    },
  };
}
