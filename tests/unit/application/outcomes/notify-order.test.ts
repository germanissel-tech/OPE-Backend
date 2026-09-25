// Feature 013, user stories 1, 2 and 5 (FR-002..FR-004, FR-020, FR-041; ADR-021): the order
// use case with fakes — correlation from the session's decisions, redemption, the ledger's
// first / repeat / conflict, the ledger down, and the log that names the status but never the arm.
import { describe, expect, it } from "vitest";
import {
  NotifyOrderUseCase,
  type NotifyOrderRequest,
  type OrderLedger,
} from "../../../../src/application/outcomes/index.js";
import {
  asDecisionId,
  InterveneDecision,
  LedgerUnavailable,
  NoOpDecision,
  type Decision,
} from "../../../../src/domain/ledger/index.js";
import { asOrderId, type Order, Corroboration } from "../../../../src/domain/outcomes/index.js";
import {
  asExperimentId,
  asMerchantId,
  asSessionId,
  asVisitorId,
  Money,
  type Incentive,
} from "../../../../src/domain/shared-kernel/index.js";
import { memoryDecisionLedger } from "../../../../src/interface-adapters/ledger/gateways/memory-decision-ledger.js";
import { memoryCorroborationLedger } from "../../../../src/interface-adapters/outcomes/gateways/memory-corroboration-ledger.js";
import { memoryOrderLedger } from "../../../../src/interface-adapters/outcomes/gateways/memory-order-ledger.js";
import { TEST_TOLERANCE, TEST_VERSIONS } from "../../../helpers/platform.js";
import { corpusEntryOf } from "../../../helpers/sayable.js";
import { recordingLogger, unavailableOrderLedger } from "../../../helpers/unavailable-ledgers.js";

const A = asMerchantId("m_a");
const S = asSessionId("ses_00000001");
const V = asVisitorId("vis_00000001");
const NOW = new Date("2026-09-19T12:00:00.000Z");
const experiment = { experimentId: asExperimentId("exp_1"), arm: "TREATMENT" as const };

const facts = (id: string) => ({
  decisionId: asDecisionId(id),
  configuration: TEST_VERSIONS,
  merchantId: A,
  sessionId: S,
  visitorId: V,
  decidedAt: NOW,
});
const noOp = (id: string, withExperiment = true): Decision =>
  NoOpDecision.of({ ...facts(id), ...(withExperiment ? { experiment } : {}) }, "control-arm");
const granting = (id: string, value: number): Decision =>
  InterveneDecision.of({ ...facts(id), experiment }, "price", {
    anchor: "price",
    messageVersionId: corpusEntryOf("price.price.incentive").version,
    text: "If it does not fit, the exchange is free.",
    incentive: { kind: "percent", value },
  });

const request = (over: Partial<NotifyOrderRequest> = {}): NotifyOrderRequest => ({
  merchantId: A,
  orderId: asOrderId("A-1"),
  total: Money.rehydrate({ amount: "100.00", currency: "ARS" }),
  items: [{ sku: "SKU-1", quantity: 1 }],
  confirmedAt: new Date("2026-09-19T11:59:00.000Z"),
  ...over,
});

async function subject(
  options: { decisions?: Decision[]; orders?: OrderLedger; corroborated?: boolean } = {},
) {
  const decisions = memoryDecisionLedger();
  for (const d of options.decisions ?? []) await decisions.record(d);
  const corroborations = memoryCorroborationLedger();
  if (options.corroborated) {
    await corroborations.record(
      Corroboration.rehydrate({
        merchantId: A,
        orderId: asOrderId("A-1"),
        sessionId: S,
        visitorId: V,
        confirmedAt: NOW,
        receivedAt: NOW,
      }),
    );
  }
  const orders = options.orders ?? memoryOrderLedger();
  const { logger, entries } = recordingLogger();
  const useCase = new NotifyOrderUseCase({
    clock: { now: () => NOW },
    tolerance: TEST_TOLERANCE,
    orders,
    decisions,
    corroborations,
    logger,
  });
  return { useCase, orders, entries };
}

const orderOf = async (
  useCase: NotifyOrderUseCase,
  over: Partial<NotifyOrderRequest> = {},
): Promise<Order> => {
  const result = await useCase.execute(request(over));
  if (!result.ok) throw new Error(result.error.message);
  return result.value.order;
};

describe("NotifyOrderUseCase — correlation (user story 1)", () => {
  it("a known session → attributed, with the experiment of the session's decisions", async () => {
    const { useCase } = await subject({ decisions: [noOp("d1")] });
    const order = await orderOf(useCase, { sessionId: S });
    expect(order.status()).toBe("ATTRIBUTED_ORDER");
    expect(order.correlationStatus()).toBe("ATTRIBUTED");
    expect(order.correlation).toMatchObject({ sessionId: S, visitorId: V, experiment });
    expect(order.receivedAt).toEqual(NOW);
  });

  it("without a session → pending; the decision ledger is not even asked", async () => {
    const decisions = memoryDecisionLedger();
    let asked = 0;
    const { useCase } = await subject();
    const spied = new NotifyOrderUseCase({
      clock: { now: () => NOW },
      tolerance: TEST_TOLERANCE,
      orders: memoryOrderLedger(),
      decisions: {
        ...decisions,
        bySession: (m, s) => {
          asked += 1;
          return decisions.bySession(m, s);
        },
      },
      corroborations: memoryCorroborationLedger(),
      logger: recordingLogger().logger,
    });
    const pending = await orderOf(spied);
    expect(pending.status()).toBe("VERIFIED_ORDER");
    expect(pending.correlationStatus()).toBe("PENDING_CORRELATION");
    expect(asked).toBe(0);
    expect((await orderOf(useCase, { sessionId: S })).correlationStatus()).toBe("PENDING_CORRELATION");
  });

  it("a known session whose decisions had no experiment → attributed without a group", async () => {
    const { useCase } = await subject({ decisions: [noOp("d1", false)] });
    const order = await orderOf(useCase, { sessionId: S });
    expect(order.status()).toBe("ATTRIBUTED_ORDER");
    expect(order.correlation?.experiment).toBeUndefined();
  });

  it("an invalid order (duplicate SKU) fails before touching any ledger", async () => {
    const orders = memoryOrderLedger();
    let touched = false;
    const { useCase } = await subject({
      orders: {
        ...orders,
        record: (o) => {
          touched = true;
          return orders.record(o);
        },
      },
    });
    const result = await useCase.execute(
      request({
        items: [
          { sku: "a", quantity: 1 },
          { sku: "a", quantity: 1 },
        ],
      }),
    );
    expect(result.ok ? undefined : result.error.code).toBe("duplicate-order-item");
    expect(touched).toBe(false);
  });
});

describe("NotifyOrderUseCase — idempotency (user story 2)", () => {
  it("created, then repeated with the original record even if the session became known meanwhile; conflict on different content", async () => {
    const decisions: Decision[] = [];
    const { useCase } = await subject({ decisions });
    const first = await useCase.execute(request({ sessionId: S }));
    expect(first.ok && first.value.outcome).toBe("created");
    const ledger = memoryDecisionLedger();
    await ledger.record(noOp("d1"));
    const again = await useCase.execute(request({ sessionId: S }));
    expect(again.ok && again.value.outcome).toBe("repeated");
    expect(again.ok && again.value.order.status()).toBe("VERIFIED_ORDER");
    const conflict = await useCase.execute(request({ sessionId: S, items: [{ sku: "SKU-1", quantity: 2 }] }));
    expect(conflict.ok ? undefined : conflict.error.code).toBe("idempotency-conflict");
    expect(conflict.ok ? undefined : conflict.error.message).toContain("A-1");
  });

  it("the ledger down → ledger-unavailable, nothing recorded", async () => {
    const { useCase } = await subject({ orders: unavailableOrderLedger() });
    const result = await useCase.execute(request());
    expect(result.ok ? undefined : result.error).toBeInstanceOf(LedgerUnavailable);
  });

  it("a record that fails for the session lookup does not happen: bySession is read, record is atomic", async () => {
    const orders = memoryOrderLedger();
    const calls: string[] = [];
    const spied: OrderLedger = {
      ...orders,
      record: (o) => {
        calls.push("record");
        return orders.record(o);
      },
      find: (m, id) => {
        calls.push("find");
        return orders.find(m, id);
      },
    };
    const { useCase } = await subject({ orders: spied, decisions: [noOp("d1")] });
    await orderOf(useCase, { sessionId: S });
    expect(calls).toEqual(["record"]);
  });
});

describe("NotifyOrderUseCase — redemption (user story 5) and the log", () => {
  const percent = (value: number): Incentive => ({ kind: "percent", value });

  it("crosses the declared incentive with the last one granted in the session", async () => {
    const { useCase } = await subject({ decisions: [granting("d1", 5), granting("d2", 10)] });
    expect((await orderOf(useCase, { sessionId: S, incentive: percent(10) })).redemption?.verdict).toBe(
      "matched",
    );
    expect(
      (await orderOf(useCase, { orderId: asOrderId("A-2"), sessionId: S, incentive: percent(5) })).redemption
        ?.verdict,
    ).toBe("mismatched");
    expect((await orderOf(useCase, { orderId: asOrderId("A-3"), sessionId: S })).redemption?.verdict).toBe(
      "not-applied",
    );
    expect(
      (await orderOf(useCase, { orderId: asOrderId("A-4"), incentive: percent(5) })).redemption?.verdict,
    ).toBe("unverifiable");
  });

  it("logs the status, the redemption and whether the SDK had corroborated; never the arm nor the visitor; only on creation", async () => {
    const { useCase, entries } = await subject({ decisions: [granting("d1", 5)], corroborated: true });
    await orderOf(useCase, { sessionId: S, incentive: percent(5) });
    await orderOf(useCase, { sessionId: S, incentive: percent(5) });
    const recorded = entries.filter((e) => e.message === "order recorded");
    expect(recorded).toHaveLength(1);
    expect(recorded[0]?.fields).toEqual({
      merchantId: A,
      orderId: "A-1",
      status: "ATTRIBUTED_ORDER",
      redemption: "matched",
      corroborated: true,
    });
  });

  it("without redemption the log has no redemption key; without corroboration, corroborated is false", async () => {
    const { useCase, entries } = await subject({ decisions: [noOp("d1")] });
    await orderOf(useCase, { sessionId: S });
    expect(entries[0]?.fields).toEqual({
      merchantId: A,
      orderId: "A-1",
      status: "ATTRIBUTED_ORDER",
      corroborated: false,
    });
  });
});
