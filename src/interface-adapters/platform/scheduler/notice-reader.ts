// What reads the notices of `subscribe` (feature 044, ADR-047; research R-06): "notice + read". A notice says only
// which order or return changed; this reads it from the platform and deposits **what it read** through the same
// use cases the `push` enters by, wrapped in the gate with `subscribe`. The state the notice carried never
// decides anything: the merchant's confirmation rule judges the state that was read.
//
// Three outcomes for every notice that is due:
//
//   - **read**: deposited, or read and not confirmed yet (the platform will notice again when it is), or refused
//     by the core (logged, like the scheduler does with a change it refuses). The notice is forgotten.
//   - **retry**: the platform did not answer, does not have the reference yet, or the store could not write.
//     The notice is read again after `noticeRetry.afterMs`.
//   - **dropped**: the attempts ran out. The notice is forgotten **with a trace**: in the log, with the merchant,
//     the flow and the reference, and in where the flow stands, which an operator reads.
import { LedgerUnavailable } from "../../../domain/ledger/index.js";
import { StoreUnavailable, type DomainError, type Result } from "../../../domain/shared-kernel/index.js";
import type { NotifyOrderRequest, NotifyReturnRequest } from "../../../application/outcomes/index.js";
import type {
  NoticeQueue,
  PlatformPolicies,
  PlatformPolicy,
  SyncStateStore,
} from "../../../application/platform/index.js";
import type { Logger, UseCase } from "../../../application/shared-kernel/index.js";
import type { Notice, SyncOutcome } from "../../../domain/platform/index.js";
import type { InstalledSources, PlatformSource } from "../source.js";

type Deposit<I> = UseCase<I, Result<unknown, DomainError>>;

export interface NoticeReaderDeps {
  notices: NoticeQueue;
  policies: PlatformPolicies;
  states: SyncStateStore;
  sources: InstalledSources;
  notifyOrder: Deposit<NotifyOrderRequest>;
  notifyReturn: Deposit<NotifyReturnRequest>;
  logger: Logger;
}

export interface NoticeReader {
  /** Reads every notice that is due at `now`. A test calls it with its clock; the scheduler, on every tick. */
  readDue(now: Date): Promise<void>;
}

/** Why a read did not happen; it is retried, and it is the reason of the trace when the attempts run out. */
class Unread extends Error {}

const causeOf = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

export function noticeReader(deps: NoticeReaderDeps): NoticeReader {
  return new NoticeReading(deps);
}

class NoticeReading implements NoticeReader {
  readonly #deps: NoticeReaderDeps;

  constructor(deps: NoticeReaderDeps) {
    this.#deps = deps;
  }

  async readDue(now: Date): Promise<void> {
    for (const notice of await this.#deps.notices.due(now)) await this.#read(notice, now);
  }

  async #read(notice: Notice, now: Date): Promise<void> {
    const policy = await this.#deps.policies.policyFor(notice.merchantId);
    let deposited: number;
    try {
      deposited = await this.#deposit(notice, policy, now);
    } catch (cause) {
      await this.#retry(notice, policy, now, causeOf(cause));
      return;
    }
    await this.#deps.notices.remove(notice);
    await this.#record(notice, now, { status: "ok", count: deposited });
  }

  /** How many records the read deposited: one, or none when there was nothing to record yet. */
  async #deposit(notice: Notice, policy: PlatformPolicy, now: Date): Promise<number> {
    const source = this.#deps.sources.readerOf(policy.source);
    if (source === undefined) throw new Unread("The source of the merchant is not installed.");
    const result =
      notice.flow === "orders"
        ? await this.#order(notice, policy, source, now)
        : await this.#return(notice, source, now);
    if (result === undefined) return 0;
    if (result.ok) return 1;
    if (result.error instanceof LedgerUnavailable || result.error instanceof StoreUnavailable) {
      throw new Unread(`The store could not record it (${result.error.code}).`);
    }
    this.#deps.logger.warn(
      { merchantId: notice.merchantId, flow: notice.flow, code: result.error.code },
      "The core refused what a notice led to read; the notice is done.",
    );
    return 0;
  }

  async #order(notice: Notice, policy: PlatformPolicy, source: PlatformSource, now: Date) {
    const order = await source.order(notice.merchantId, notice.reference);
    if (order === undefined) throw new Unread("The platform does not have the order of the notice.");
    // The state that was **read** is the one judged (research R-07); the one the notice said is not.
    if (!policy.confirmation.confirms(order.state)) return undefined;
    return this.#deps.notifyOrder.execute({
      merchantId: notice.merchantId,
      orderId: order.orderId,
      total: order.total,
      items: order.items,
      confirmedAt: order.confirmedAt ?? now,
      sessionId: order.sessionId,
    });
  }

  async #return(notice: Notice, source: PlatformSource, now: Date) {
    const returned = await source.returnOf(notice.merchantId, notice.reference);
    if (returned === undefined) throw new Unread("The platform does not have the return of the notice.");
    return this.#deps.notifyReturn.execute({
      merchantId: notice.merchantId,
      orderId: returned.orderId,
      returnedAt: returned.returnedAt ?? now,
      items: returned.items,
    });
  }

  async #retry(notice: Notice, policy: PlatformPolicy, now: Date, cause: string): Promise<void> {
    const attempts = notice.attempts + 1;
    const nextAt = policy.retry.nextAfter(attempts, now);
    const { merchantId, flow, reference } = notice;
    if (nextAt !== undefined) {
      this.#deps.logger.warn(
        { merchantId, flow, attempts, cause },
        "A notice could not be read; it is read again later.",
      );
      await this.#deps.notices.reschedule({ ...notice, attempts, nextAt });
      return;
    }
    this.#deps.logger.error(
      { merchantId, flow, reference, attempts, cause },
      "A notice could not be read and its attempts ran out; it is dropped.",
    );
    await this.#deps.notices.remove(notice);
    await this.#record(notice, now, { status: "failed", reason: "notice-dropped" });
  }

  /** Where the flow stands, as the scheduler keeps it for `pull`: an operator reads both the same way. */
  async #record(notice: Notice, now: Date, outcome: SyncOutcome): Promise<void> {
    const previous = (await this.#deps.states.statesOf(notice.merchantId))[notice.flow] ?? {};
    await this.#deps.states.save(notice.merchantId, notice.flow, {
      ...previous,
      lastRunAt: now,
      lastOkAt: outcome.status === "ok" ? now : previous.lastOkAt,
      lastOutcome: outcome,
    });
  }
}
