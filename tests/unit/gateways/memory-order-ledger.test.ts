// Feature 013 (FR-020, FR-022, FR-036, FR-038; SC-002): the order ledger in memory decides
// first / repeat / conflict in one synchronous section — two simultaneous notifications of the
// same order produce one record — and nothing crosses merchants.
import { describe, expect, it } from "vitest";
import {
  asOrderId,
  Order,
  Return,
  type OrderRecord,
  Corroboration,
} from "../../../src/domain/outcomes/index.js";
import { asMerchantId, Money, asSessionId, asVisitorId } from "../../../src/domain/shared-kernel/index.js";
import { memoryCorroborationLedger } from "../../../src/interface-adapters/gateways/outcomes/memory-corroboration-ledger.js";
import { memoryOrderLedger } from "../../../src/interface-adapters/gateways/outcomes/memory-order-ledger.js";

const A = asMerchantId("m_a");
const B = asMerchantId("m_b");
const NOW = new Date("2026-09-19T12:00:00.000Z");
const ID = asOrderId("A-1");

const order = (over: Partial<OrderRecord> = {}): Order =>
  Order.rehydrate({
    merchantId: A,
    orderId: ID,
    total: Money.rehydrate({ amount: "10.00", currency: "ARS" }),
    items: [{ sku: "SKU-1", quantity: 1 }],
    confirmedAt: NOW,
    receivedAt: NOW,
    ...over,
  });
const returned = (over: Partial<Return> = {}): Return =>
  Return.rehydrate({ orderId: ID, returnedAt: NOW, receivedAt: NOW, ...over });

describe("memoryOrderLedger.record", () => {
  it("records the first, repeats the same content and conflicts on different content, keeping the first", async () => {
    const ledger = memoryOrderLedger();
    const first = order();
    expect(await ledger.record(first)).toEqual({ ok: true, value: { outcome: "recorded", order: first } });
    const same = order({ receivedAt: new Date(NOW.getTime() + 1000) });
    expect(await ledger.record(same)).toEqual({ ok: true, value: { outcome: "repeated", order: first } });
    const different = order({ total: Money.rehydrate({ amount: "11.00", currency: "ARS" }) });
    expect(await ledger.record(different)).toEqual({
      ok: true,
      value: { outcome: "conflict", order: first },
    });
    expect(await ledger.find(A, ID)).toBe(first);
  });

  it("two simultaneous notifications of the same order produce one record: recorded and repeated (SC-002)", async () => {
    const ledger = memoryOrderLedger();
    const results = await Promise.all(Array.from({ length: 20 }, () => ledger.record(order())));
    const outcomes = results.map((r) => (r.ok ? r.value.outcome : "unavailable"));
    expect(outcomes.filter((o) => o === "recorded")).toHaveLength(1);
    expect(outcomes.filter((o) => o === "repeated")).toHaveLength(19);
  });

  it("the same orderId in two merchants are two orders; another merchant finds nothing", async () => {
    const ledger = memoryOrderLedger();
    await ledger.record(order());
    expect(await ledger.record(order({ merchantId: B }))).toMatchObject({ value: { outcome: "recorded" } });
    expect((await ledger.find(A, ID))?.merchantId).toBe(A);
    expect((await ledger.find(B, ID))?.merchantId).toBe(B);
    expect(await ledger.find(A, asOrderId("A-2"))).toBeUndefined();
  });
});

describe("memoryOrderLedger.recordReturn", () => {
  it("unknown order → unknown; first return → recorded with the returned order; same → repeated; different → conflict", async () => {
    const ledger = memoryOrderLedger();
    expect(await ledger.recordReturn(A, ID, returned())).toEqual({ ok: true, value: { outcome: "unknown" } });
    await ledger.record(order());
    const first = await ledger.recordReturn(A, ID, returned());
    expect(first).toMatchObject({ value: { outcome: "recorded" } });
    if (first.ok && first.value.outcome !== "unknown") {
      expect(first.value.order.returned?.returnedAt).toEqual(NOW);
      expect(await ledger.find(A, ID)).toBe(first.value.order);
    }
    expect(
      await ledger.recordReturn(A, ID, returned({ receivedAt: new Date(NOW.getTime() + 5) })),
    ).toMatchObject({
      value: { outcome: "repeated" },
    });
    const other = returned({ items: [{ sku: "SKU-1", quantity: 1 }] });
    expect(await ledger.recordReturn(A, ID, other)).toMatchObject({ value: { outcome: "conflict" } });
    expect((await ledger.find(A, ID))?.returned?.items).toBeUndefined();
  });

  it("the return of the order of another merchant is unknown", async () => {
    const ledger = memoryOrderLedger();
    await ledger.record(order());
    expect(await ledger.recordReturn(B, ID, returned())).toEqual({ ok: true, value: { outcome: "unknown" } });
  });
});

describe("memoryCorroborationLedger", () => {
  const corroboration = (session: string, merchantId = A): Corroboration =>
    Corroboration.rehydrate({
      merchantId,
      orderId: ID,
      sessionId: asSessionId(session),
      visitorId: asVisitorId("vis_00000001"),
      confirmedAt: NOW,
      receivedAt: NOW,
    });

  it("records once per merchant, order and session; repeats otherwise; finds by order in order of arrival", async () => {
    const ledger = memoryCorroborationLedger();
    expect(await ledger.record(corroboration("ses_00000001"))).toEqual({ ok: true, value: "recorded" });
    expect(await ledger.record(corroboration("ses_00000001"))).toEqual({ ok: true, value: "repeated" });
    expect(await ledger.record(corroboration("ses_00000002"))).toEqual({ ok: true, value: "recorded" });
    expect((await ledger.find(A, ID)).map((c) => c.sessionId)).toEqual(["ses_00000001", "ses_00000002"]);
    expect(await ledger.find(B, ID)).toEqual([]);
    expect(await ledger.find(A, asOrderId("A-2"))).toEqual([]);
  });

  it("another merchant with the same order and session is another record", async () => {
    const ledger = memoryCorroborationLedger();
    await ledger.record(corroboration("ses_00000001"));
    expect(await ledger.record(corroboration("ses_00000001", B))).toEqual({ ok: true, value: "recorded" });
    expect(await ledger.find(B, ID)).toHaveLength(1);
  });
});
