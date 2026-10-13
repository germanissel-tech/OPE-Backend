// Feature 044 — US3 (FR-007..FR-010; research R-06, R-07): a notice is queued once while it is pending; reading
// it reads the platform and judges the state that was read, never the one the notice said; a read that fails is
// retried at `noticeRetry.afterMs`, and when the attempts run out the notice is dropped with a trace.
import { describe, expect, it } from "vitest";
import { AcceptNoticeUseCase, type PlatformPolicy } from "../../../../src/application/platform/index.js";
import { LedgerUnavailable } from "../../../../src/domain/ledger/index.js";
import { OrderUnknown } from "../../../../src/domain/outcomes/index.js";
import {
  NoticeRetry,
  OrderConfirmation,
  SyncCadence,
  type Notice,
} from "../../../../src/domain/platform/index.js";
import {
  DomainError,
  fail,
  ok,
  type MerchantId,
  type Result,
} from "../../../../src/domain/shared-kernel/index.js";
import {
  installedSources,
  memoryNoticeQueue,
  memorySyncStateStore,
  noticeReader,
  scriptedTestSource,
} from "../../../../src/interface-adapters/platform/index.js";
import { TEST_NOW } from "../../../helpers/merchants.js";
import type { UseCase } from "../../../../src/application/shared-kernel/index.js";

const A = "m_a" as MerchantId;
const B = "m_b" as MerchantId;
const PRICE = { amount: "10.00", currency: "ARS" };
const at = (ms: number): Date => new Date(TEST_NOW.getTime() + ms);

class Refused extends DomainError {
  readonly code = "refused-for-the-test" as const;
  readonly module = "test" as const;
  constructor() {
    super("Refused by the test.");
  }
}

const noticeOf = (over: Partial<Notice> = {}): Notice => ({
  merchantId: A,
  flow: "orders",
  reference: "o1",
  receivedAt: at(0),
  attempts: 0,
  nextAt: at(0),
  ...over,
});

function recording<I>(answer: () => Result<unknown, DomainError> = () => ok(undefined)) {
  const calls: I[] = [];
  const useCase: UseCase<I, Result<unknown, DomainError>> = {
    execute: (request) => {
      calls.push(request);
      return Promise.resolve(answer());
    },
  };
  return { calls, useCase };
}

function subject(
  answers: { order?: () => Result<unknown, DomainError>; return?: () => Result<unknown, DomainError> } = {},
) {
  const source = scriptedTestSource();
  const notices = memoryNoticeQueue();
  const states = memorySyncStateStore();
  const policy: PlatformPolicy = {
    source: "test",
    strategy: { catalog: "push", stockAndPrice: "push", orders: "subscribe", returns: "subscribe" },
    cadence: SyncCadence.rehydrate({
      catalogMs: 1,
      stockAndPriceMs: 1,
      stockAndPriceBatchSize: 1,
      ordersMs: 1,
      returnsMs: 1,
    }),
    confirmation: OrderConfirmation.rehydrate(["paid"]),
    retry: NoticeRetry.rehydrate({ afterMs: 60_000, maxAttempts: 3 }),
  };
  const order = recording<{
    merchantId: MerchantId;
    orderId: string;
    confirmedAt: Date;
    confirmedAtObserved?: true | undefined;
  }>(answers.order);
  interface ReturnRequest {
    merchantId: MerchantId;
    orderId: string;
    returnedAt: Date;
    returnedAtObserved?: true | undefined;
  }
  /** The return behind the gate of `subscribe`, and behind the gate of `pull` (feature 045). */
  const returned = recording<ReturnRequest>(answers.return);
  const returnedPull = recording<ReturnRequest>(answers.return);
  const logged: { fields: unknown; message: string }[] = [];
  const log = (fields: unknown, message: string) => {
    logged.push({ fields, message });
  };
  const reader = noticeReader({
    notices,
    policies: { policyFor: () => Promise.resolve(policy) },
    states,
    sources: installedSources(new Map([["test", source]])),
    notifyOrder: order.useCase,
    notifyReturn: { subscribe: returned.useCase, pull: returnedPull.useCase },
    logger: { info: log, warn: log, error: log },
  });
  return { source, notices, states, policy, order, returned, returnedPull, logged, reader };
}

const paid = (state = "paid", confirmedAt?: string) => ({
  orderId: "o1",
  state,
  total: PRICE,
  items: [{ sku: "s", quantity: 1 }],
  ...(confirmedAt === undefined ? {} : { confirmedAt }),
});

describe("AcceptNoticeUseCase", () => {
  it("queues the notice due at once, and a notice repeated while it is pending answers the first", async () => {
    const notices = memoryNoticeQueue();
    let now = at(0);
    const accept = new AcceptNoticeUseCase({ clock: { now: () => now }, queue: notices });
    const first = await accept.execute({ merchantId: A, flow: "orders", reference: "o1", state: "paid" });
    expect(first).toEqual(ok({ flow: "orders", reference: "o1", receivedAt: at(0) }));
    now = at(5);
    const again = await accept.execute({ merchantId: A, flow: "orders", reference: "o1" });
    expect(again).toEqual(ok({ flow: "orders", reference: "o1", receivedAt: at(0) }));
    await accept.execute({ merchantId: A, flow: "returns", reference: "o1" });
    await accept.execute({ merchantId: B, flow: "orders", reference: "o1" });
    expect(await notices.due(at(5))).toHaveLength(3);
    expect(await notices.pendingOf(A)).toEqual({ orders: 1, returns: 1 });
    expect((await notices.due(at(0)))[0]).toEqual({
      merchantId: A,
      flow: "orders",
      reference: "o1",
      state: "paid",
      receivedAt: at(0),
      attempts: 0,
      nextAt: at(0),
    });
  });

  it("a store that cannot queue says so", async () => {
    const queue = memoryNoticeQueue();
    const unavailable = { ...queue, enqueue: () => Promise.resolve(fail(new LedgerUnavailable())) };
    const accept = new AcceptNoticeUseCase({ clock: { now: () => at(0) }, queue: unavailable as never });
    const result = await accept.execute({ merchantId: A, flow: "orders", reference: "o1" });
    expect(result.ok ? undefined : result.error.code).toBe("ledger-unavailable");
  });
});

describe("memoryNoticeQueue", () => {
  it("answers only what is due, oldest first, and forgets what is removed", async () => {
    const queue = memoryNoticeQueue();
    await queue.enqueue(noticeOf({ reference: "late", nextAt: at(20) }));
    await queue.enqueue(noticeOf({ reference: "early", nextAt: at(10) }));
    await queue.enqueue(noticeOf({ reference: "later", nextAt: at(30) }));
    expect((await queue.due(at(20))).map((notice) => notice.reference)).toEqual(["early", "late"]);
    await queue.remove(noticeOf({ reference: "early" }));
    await queue.reschedule(noticeOf({ reference: "late", nextAt: at(40), attempts: 1 }));
    expect((await queue.due(at(30))).map((notice) => notice.reference)).toEqual(["later"]);
    expect(await queue.pendingOf(A)).toEqual({ orders: 2 });
    expect(await queue.pendingOf(B)).toEqual({});
  });
});

describe("noticeReader", () => {
  it("reads the order of the notice and deposits what it read, with the platform's instant or the observation's", async () => {
    const { source, notices, order, reader, states } = subject();
    source.script(A, { orders: [paid("pending"), paid("paid", "2026-09-19T11:00:00.000Z")] });
    await notices.enqueue(noticeOf({ state: "pending" }));
    await reader.readDue(at(3));
    expect(order.calls.map((call) => [call.orderId, call.confirmedAt, call.confirmedAtObserved])).toEqual([
      ["o1", new Date("2026-09-19T11:00:00.000Z"), undefined],
    ]);
    expect(await notices.due(at(99))).toEqual([]);
    expect((await states.statesOf(A)).orders).toEqual({
      lastRunAt: at(3),
      lastOkAt: at(3),
      lastOutcome: { status: "ok", count: 1 },
    });
    source.script(A, { orders: [paid("paid")] });
    await notices.enqueue(noticeOf());
    await reader.readDue(at(4));
    expect([order.calls[1]?.confirmedAt, order.calls[1]?.confirmedAtObserved]).toEqual([at(4), true]);
  });

  it("the state the notice said never decides: an order read in a state that is not confirmed is not recorded", async () => {
    const { source, notices, order, reader, states } = subject();
    source.script(A, { orders: [paid("pending")] });
    await notices.enqueue(noticeOf({ state: "paid" }));
    await reader.readDue(at(0));
    expect(order.calls).toEqual([]);
    expect(await notices.due(at(99))).toEqual([]);
    expect((await states.statesOf(A)).orders?.lastOutcome).toEqual({ status: "ok", count: 0 });
  });

  it("reads the return of a notice of returns", async () => {
    const { source, notices, returned, reader } = subject();
    source.script(A, { returns: [{ orderId: "o1" }, { orderId: "o2" }] });
    await notices.enqueue(noticeOf({ flow: "returns" }));
    await reader.readDue(at(2));
    expect(returned.calls.map((call) => [call.orderId, call.returnedAt, call.returnedAtObserved])).toEqual([
      ["o1", at(2), true],
    ]);
  });

  it("a read that fails is read again after the merchant's wait, counting the attempt", async () => {
    const { source, notices, order, reader, logged } = subject();
    source.script(A, { failing: true });
    await notices.enqueue(noticeOf());
    await reader.readDue(at(0));
    expect(await notices.due(at(59_999))).toEqual([]);
    expect(await notices.due(at(60_000))).toEqual([noticeOf({ attempts: 1, nextAt: at(60_000) })]);
    expect(logged).toEqual([
      {
        fields: { merchantId: A, flow: "orders", attempts: 1, cause: "The test platform does not answer." },
        message: "A notice could not be read; it is read again later.",
      },
    ]);
    source.script(A, { orders: [paid()] });
    await reader.readDue(at(60_000));
    expect(order.calls).toHaveLength(1);
    expect(await notices.due(at(999_999))).toEqual([]);
  });

  it("a reference the platform does not have yet, a return included, is read again", async () => {
    const { notices, reader } = subject();
    await notices.enqueue(noticeOf());
    await notices.enqueue(noticeOf({ flow: "returns" }));
    await reader.readDue(at(0));
    expect((await notices.due(at(60_000))).map((notice) => [notice.flow, notice.attempts])).toEqual([
      ["orders", 1],
      ["returns", 1],
    ]);
  });

  it("an unavailable store is read again; a refusal of the core is logged and the notice is done", async () => {
    let answer: Result<unknown, DomainError> = fail(new LedgerUnavailable());
    const { source, notices, reader, logged, states } = subject({ order: () => answer });
    source.script(A, { orders: [paid()] });
    await notices.enqueue(noticeOf());
    await reader.readDue(at(0));
    expect(await notices.due(at(60_000))).toHaveLength(1);
    answer = fail(new Refused());
    logged.length = 0;
    await reader.readDue(at(60_000));
    expect(await notices.due(at(999_999))).toEqual([]);
    expect(logged).toEqual([
      {
        fields: { merchantId: A, flow: "orders", code: "refused-for-the-test" },
        message: "The core refused what a notice led to read; the notice is done.",
      },
    ]);
    expect((await states.statesOf(A)).orders?.lastOutcome).toEqual({ status: "ok", count: 0 });
  });

  it("a return whose order is not recorded yet is read again, not done (feature 045)", async () => {
    const { source, notices, reader, returned, logged } = subject({
      return: () => fail(new OrderUnknown("o1")),
    });
    source.script(A, { returns: [{ orderId: "o1" }] });
    await notices.enqueue(noticeOf({ flow: "returns" }));
    await reader.readDue(at(0));
    expect(returned.calls).toHaveLength(1);
    expect(await notices.due(at(60_000))).toEqual([
      noticeOf({ flow: "returns", attempts: 1, nextAt: at(60_000) }),
    ]);
    expect(logged.map((entry) => entry.message)).toEqual([
      "A notice could not be read; it is read again later.",
    ]);
  });

  it("a return a run of pull left waiting is deposited behind the gate of pull, and a notice behind the one of subscribe (feature 045)", async () => {
    const { source, notices, reader, returned, returnedPull } = subject();
    source.script(A, { returns: [{ orderId: "o1" }, { orderId: "o2" }] });
    await notices.enqueue(noticeOf({ flow: "returns", via: "pull" }));
    await notices.enqueue(noticeOf({ flow: "returns", reference: "o2" }));
    await reader.readDue(at(0));
    expect(returnedPull.calls.map((call) => call.orderId)).toEqual(["o1"]);
    expect(returned.calls.map((call) => call.orderId)).toEqual(["o2"]);
  });

  it("when the attempts run out the notice is dropped with a trace, in the log and in where the flow stands", async () => {
    const { source, notices, reader, logged, states } = subject();
    source.script(A, { failing: true });
    await states.save(A, "orders", { lastOkAt: at(-1) });
    await notices.enqueue(noticeOf({ attempts: 2 }));
    await reader.readDue(at(7));
    expect(await notices.due(at(999_999))).toEqual([]);
    expect(logged).toEqual([
      {
        fields: {
          merchantId: A,
          flow: "orders",
          reference: "o1",
          attempts: 3,
          cause: "The test platform does not answer.",
        },
        message: "A notice could not be read and its attempts ran out; it is dropped.",
      },
    ]);
    expect((await states.statesOf(A)).orders).toEqual({
      lastRunAt: at(7),
      lastOkAt: at(-1),
      lastOutcome: { status: "failed", reason: "notice-dropped" },
    });
  });

  it("a merchant whose source is not installed is read again, and nothing of another merchant is touched", async () => {
    const { notices, reader, policy, source } = subject();
    policy.source = "generic";
    source.script(B, { orders: [paid()] });
    await notices.enqueue(noticeOf());
    await reader.readDue(at(0));
    expect((await notices.due(at(60_000)))[0]?.attempts).toBe(1);
  });
});
