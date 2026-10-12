// The scheduler of `pull` (feature 044, ADR-047; research R-03): what reads the platforms of the merchants that
// do not send. For the core it is the same as a controller — it turns what a source gives into the request of
// a use case and calls it — and it calls the **same four** the `push` enters by, wrapped in the mode gate with
// `pull`, so a flow changed to `push` between two runs stops being read on the next one.
//
// **Off the decision path, by construction**: it runs on its own timer, and what it deposits the decision reads
// the way it reads what the `push` deposited — from the store, never from a source.
//
// Four things about it are decisions and not details:
//
//   - **The cursor moves only after the deposit.** A restart between the two repeats the batch, and the
//     idempotency of the use cases (by instant, by `orderId`) absorbs it; the other order would lose it.
//   - **One change the core refuses does not stop the flow**: it is logged and the run goes on, or one strange
//     order would hold every later one forever. A store that is **unavailable** does stop it, and the cursor
//     stays: what was not written is read again.
//   - **Never two runs of the same merchant and flow at once**, marked in memory: the MVP is one instance
//     (constitution IV).
//   - **The cadence counts from the start of the last run, whatever it ended in**: a platform that fails is
//     not asked again on every tick.
import { LedgerUnavailable } from "../../../domain/ledger/index.js";
import {
  StoreUnavailable,
  SYNC_FLOWS,
  type DomainError,
  type MerchantId,
  type Result,
  type SyncFlow,
} from "../../../domain/shared-kernel/index.js";
import type {
  CatalogStore,
  RefreshStockAndPriceRequest,
  UpsertCatalogSnapshotRequest,
} from "../../../application/catalog/index.js";
import type { MerchantStore } from "../../../application/merchant/index.js";
import type { NotifyOrderRequest, NotifyReturnRequest } from "../../../application/outcomes/index.js";
import type {
  PlatformPolicies,
  PlatformPolicy,
  SyncStateStore,
} from "../../../application/platform/index.js";
import type { Logger, UseCase } from "../../../application/shared-kernel/index.js";
import type { VariantId } from "../../../domain/catalog/index.js";
import type { SyncOutcome, SyncState } from "../../../domain/platform/index.js";
import type { InstalledSources, PlatformSource, SourceChanges } from "../source.js";

/** A use case of the port as the scheduler sees it: what it answers matters only as done or refused. */
type Deposit<I> = UseCase<I, Result<unknown, DomainError>>;

export interface PlatformSchedulerDeps {
  merchants: Pick<MerchantStore, "list">;
  policies: PlatformPolicies;
  states: SyncStateStore;
  sources: InstalledSources;
  /** The current catalogue, whose variants the stock-and-price batches walk through. */
  catalog: Pick<CatalogStore, "current">;
  upsertCatalog: Deposit<UpsertCatalogSnapshotRequest>;
  refreshStockAndPrice: Deposit<RefreshStockAndPriceRequest>;
  notifyOrder: Deposit<NotifyOrderRequest>;
  notifyReturn: Deposit<NotifyReturnRequest>;
  logger: Logger;
}

export interface PlatformScheduler {
  /** Every flow in `pull` whose cadence is due, of every merchant that is on. A test calls it with its clock. */
  runDue(now: Date): Promise<void>;
}

/** How a run ended, and where the next one resumes. */
interface Run {
  outcome: SyncOutcome;
  cursor: string | undefined;
}

/** What one run reads with: the merchant, its policy, where the flow stands and the instant of the observation. */
interface Reading {
  merchantId: MerchantId;
  policy: PlatformPolicy;
  state: SyncState;
  now: Date;
}

/** Merchants read per page while walking the directory; how many are read at once changes nothing observable. */
const MERCHANTS_PER_PAGE = 100;

const done = (count: number, cursor: string | undefined): Run => ({
  outcome: { status: "ok", count },
  cursor,
});
const failed = (reason: string, cursor: string | undefined): Run => ({
  outcome: { status: "failed", reason },
  cursor,
});

/** A failure of the store, not of the change: what was not written has to be read again. */
const unavailable = (error: DomainError): boolean =>
  error instanceof LedgerUnavailable || error instanceof StoreUnavailable;

/** Lexicographic, which is what the cursor of a batch means (data model, `platform_sync`). */
const lexicographic = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const causeOf = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

export function platformScheduler(deps: PlatformSchedulerDeps): PlatformScheduler {
  return new PullScheduler(deps);
}

class PullScheduler implements PlatformScheduler {
  readonly #deps: PlatformSchedulerDeps;
  readonly #running = new Set<string>();

  constructor(deps: PlatformSchedulerDeps) {
    this.#deps = deps;
  }

  async runDue(now: Date): Promise<void> {
    let cursor: string | undefined;
    do {
      const page = await this.#deps.merchants.list({ cursor, limit: MERCHANTS_PER_PAGE });
      for (const merchant of page.items) {
        if (merchant.isOn()) await this.#runMerchant(merchant.merchantId, now);
      }
      cursor = page.nextCursor;
    } while (cursor !== undefined);
  }

  async #runMerchant(merchantId: MerchantId, now: Date): Promise<void> {
    const policy = await this.#deps.policies.policyFor(merchantId);
    const pulled = SYNC_FLOWS.filter((flow) => policy.strategy[flow] === "pull");
    if (pulled.length === 0) return;
    const states = await this.#deps.states.statesOf(merchantId);
    for (const flow of pulled) {
      const state = states[flow] ?? {};
      const last = state.lastRunAt?.getTime();
      if (last !== undefined && now.getTime() - last < policy.cadence.intervalOf(flow)) continue;
      const key = `${merchantId}/${flow}`;
      if (this.#running.has(key)) continue;
      this.#running.add(key);
      try {
        await this.#runFlow({ merchantId, policy, state, now }, flow);
      } finally {
        this.#running.delete(key);
      }
    }
  }

  async #runFlow(reading: Reading, flow: SyncFlow): Promise<void> {
    const { merchantId, state, now } = reading;
    const run = await this.#read(reading, flow);
    if (run.outcome.status === "failed") {
      this.#deps.logger.warn(
        { merchantId, flow, reason: run.outcome.reason },
        "A run of the platform reading failed.",
      );
    }
    await this.#deps.states.save(merchantId, flow, {
      cursor: run.cursor,
      lastRunAt: now,
      lastOkAt: run.outcome.status === "ok" ? now : state.lastOkAt,
      lastOutcome: run.outcome,
    });
  }

  async #read(reading: Reading, flow: SyncFlow): Promise<Run> {
    const source = this.#deps.sources.readerOf(reading.policy.source);
    // The configuration refused this when it was published; a deployment that later left the source out still
    // serves the merchant, and this is where it says that nothing is read.
    if (source === undefined) return failed("source-not-installed", reading.state.cursor);
    try {
      return await this.#flow(flow, reading, source);
    } catch (cause) {
      this.#deps.logger.warn(
        { merchantId: reading.merchantId, flow, cause: causeOf(cause) },
        "The platform did not answer a read; nothing was deposited.",
      );
      return failed("source-failed", reading.state.cursor);
    }
  }

  #flow(flow: SyncFlow, reading: Reading, source: PlatformSource): Promise<Run> {
    switch (flow) {
      case "catalog":
        return this.#catalog(reading, source);
      case "stockAndPrice":
        return this.#stockAndPrice(reading, source);
      case "orders":
        return this.#orders(reading, source);
      case "returns":
        return this.#returns(reading, source);
    }
  }

  async #catalog({ merchantId, state, now }: Reading, source: PlatformSource): Promise<Run> {
    const read = await source.catalog(merchantId);
    const deposited = await this.#deps.upsertCatalog.execute({
      merchantId,
      capturedAt: read.capturedAt ?? now,
      products: read.products,
    });
    return deposited.ok ? done(read.products.length, undefined) : failed(deposited.error.code, state.cursor);
  }

  async #stockAndPrice({ merchantId, policy, state, now }: Reading, source: PlatformSource): Promise<Run> {
    const snapshot = await this.#deps.catalog.current(merchantId);
    const variants: VariantId[] = (snapshot?.products ?? [])
      .flatMap((product) => product.variants.map((variant) => variant.variantId))
      .sort(lexicographic);
    const after = variants.filter((variantId) => state.cursor === undefined || variantId > state.cursor);
    // Past the last variant the cycle starts again (SC-002): every variant is read once per cycle.
    const batch = (after.length === 0 ? variants : after).slice(0, policy.cadence.stockAndPriceBatchSize);
    const last = batch.at(-1);
    if (last === undefined) return done(0, state.cursor);
    const items = await source.stockAndPrice(merchantId, batch);
    if (items.length > 0) {
      const deposited = await this.#deps.refreshStockAndPrice.execute({
        merchantId,
        items: items.map((item) => ({ ...item, observedAt: item.observedAt ?? now })),
      });
      if (!deposited.ok) return failed(deposited.error.code, state.cursor);
    }
    return done(items.length, last);
  }

  async #orders(reading: Reading, source: PlatformSource): Promise<Run> {
    const { merchantId, policy, state, now } = reading;
    const read = await source.orderChanges(merchantId, state.cursor);
    return this.#deposited(reading, "orders", read, (order) =>
      // Only what the merchant counts as confirmed enters (research R-07); the rest is not an order yet.
      policy.confirmation.confirms(order.state)
        ? this.#deps.notifyOrder.execute({
            merchantId,
            orderId: order.orderId,
            total: order.total,
            items: order.items,
            confirmedAt: order.confirmedAt ?? now,
            sessionId: order.sessionId,
          })
        : undefined,
    );
  }

  async #returns(reading: Reading, source: PlatformSource): Promise<Run> {
    const { merchantId, state, now } = reading;
    const read = await source.returnChanges(merchantId, state.cursor);
    return this.#deposited(reading, "returns", read, (returned) =>
      this.#deps.notifyReturn.execute({
        merchantId,
        orderId: returned.orderId,
        returnedAt: returned.returnedAt ?? now,
        items: returned.items,
      }),
    );
  }

  /** Each change deposited in order; one the core refuses is logged and skipped, an unavailable store stops. */
  async #deposited<T>(
    reading: Reading,
    flow: SyncFlow,
    read: SourceChanges<T>,
    deposit: (change: T) => Promise<Result<unknown, DomainError>> | undefined,
  ): Promise<Run> {
    let count = 0;
    for (const change of read.changes) {
      const pending = deposit(change);
      if (pending === undefined) continue;
      const result = await pending;
      if (result.ok) {
        count += 1;
        continue;
      }
      if (unavailable(result.error)) return failed(result.error.code, reading.state.cursor);
      this.#deps.logger.warn(
        { merchantId: reading.merchantId, flow, code: result.error.code },
        "The core refused a change read from the platform; the run goes on without it.",
      );
    }
    return done(count, read.cursor);
  }
}
