// Feature 013 (FR-011, FR-020, FR-021; SC-001): an order only exists valid — no SKU repeats,
// no confirmation ahead of the clock beyond the tolerance — and its content equality is
// canonical: what the platform sent, whatever the order of the lines and whatever OPE derived.
import { describe, expect, it } from "vitest";
import {
  asOrderId,
  Correlation,
  DuplicateOrderItem,
  IncentiveRedemption,
  Order,
  OrderConfirmedInFuture,
  Return,
  type OrderRecord,
} from "../../../../src/domain/outcomes/index.js";
import {
  asMerchantId,
  asSessionId,
  asVisitorId,
  minutes,
  Money,
} from "../../../../src/domain/shared-kernel/index.js";

const NOW = new Date("2026-09-19T12:00:00.000Z");
/** The skew the platform tolerates (level 1 of the configuration), as the tests declare it. */
const SKEW_MS = minutes(5);
const base: OrderRecord = {
  merchantId: asMerchantId("m_a"),
  orderId: asOrderId("A-1"),
  total: Money.rehydrate({ amount: "100.00", currency: "ARS" }),
  items: [
    { sku: "SKU-2", quantity: 1 },
    { sku: "SKU-1", quantity: 2 },
  ],
  confirmedAt: new Date("2026-09-19T11:59:00.000Z"),
  receivedAt: NOW,
};
const valid = (over: Partial<OrderRecord> = {}): Order => {
  const built = Order.of({ ...base, ...over }, SKEW_MS);
  if (!built.ok) throw new Error(built.error.message);
  return built.value;
};

describe("Order.of", () => {
  it("accepts an order as the platform sends it and keeps its lines as sent", () => {
    const order = valid();
    expect(order.items).toEqual(base.items);
    expect(order.status()).toBe("VERIFIED_ORDER");
    expect(order.correlationStatus()).toBe("PENDING_CORRELATION");
    expect(order.sessionId).toBeUndefined();
  });

  it("a repeated SKU → duplicate-order-item naming it", () => {
    const built = Order.of(
      {
        ...base,
        items: [
          { sku: "SKU-1", quantity: 1 },
          { sku: "SKU-1", quantity: 1 },
        ],
      },
      SKEW_MS,
    );
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(built.error).toBeInstanceOf(DuplicateOrderItem);
      expect(built.error.code).toBe("duplicate-order-item");
      expect(built.error.message).toContain("SKU-1");
    }
  });

  it("a confirmation beyond the tolerance ahead of the clock → order-confirmed-in-future; at the tolerance it is fine", () => {
    const late = Order.of({ ...base, confirmedAt: new Date(NOW.getTime() + SKEW_MS + 1) }, SKEW_MS);
    // The tolerance travels in the details, not repeated in the message (015 F-022).
    if (!late.ok) {
      expect(late.error.details).toEqual({ toleranceMs: SKEW_MS });
      expect(late.error.message).not.toMatch(/\d/);
    }
    expect(late.ok ? undefined : late.error).toBeInstanceOf(OrderConfirmedInFuture);
    expect(Order.of({ ...base, confirmedAt: new Date(NOW.getTime() + SKEW_MS) }, SKEW_MS).ok).toBe(true);
  });

  it("checks the duplicate before the instant", () => {
    const both = Order.of(
      {
        ...base,
        items: [
          { sku: "SKU-1", quantity: 1 },
          { sku: "SKU-1", quantity: 1 },
        ],
        confirmedAt: new Date(NOW.getTime() + SKEW_MS + 1),
      },
      SKEW_MS,
    );
    expect(both.ok ? undefined : both.error.code).toBe("duplicate-order-item");
  });
});

describe("Order.sameContentAs", () => {
  const session = asSessionId("ses_00000001");

  it("the same lines in another order, and another receipt instant, are the same content", () => {
    const shuffled = valid({
      items: [
        { sku: "SKU-1", quantity: 2 },
        { sku: "SKU-2", quantity: 1 },
      ],
      receivedAt: new Date(NOW.getTime() + 60_000),
    });
    expect(valid().sameContentAs(shuffled)).toBe(true);
    expect(shuffled.sameContentAs(valid())).toBe(true);
  });

  it("what OPE derived does not count: the correlation, the redemption and the return", () => {
    const decisions: never[] = [];
    const correlation = Correlation.rehydrate({ sessionId: session, visitorId: asVisitorId("vis_1") });
    expect(decisions).toEqual([]);
    const attributed = Order.rehydrate({ ...valid({ sessionId: session }).record(), correlation });
    expect(valid({ sessionId: session }).sameContentAs(attributed)).toBe(true);
    const returned = Return.rehydrate({ orderId: base.orderId, returnedAt: NOW, receivedAt: NOW });
    expect(valid().sameContentAs(valid().withReturn(returned))).toBe(true);
  });

  it.each<[string, Partial<OrderRecord>]>([
    ["another total", { total: Money.rehydrate({ amount: "100.01", currency: "ARS" }) }],
    ["another currency", { total: Money.rehydrate({ amount: "100.00", currency: "USD" }) }],
    [
      "another quantity",
      {
        items: [
          { sku: "SKU-2", quantity: 1 },
          { sku: "SKU-1", quantity: 3 },
        ],
      },
    ],
    ["a line more", { items: [...base.items, { sku: "SKU-3", quantity: 1 }] }],
    ["a line less", { items: [{ sku: "SKU-1", quantity: 2 }] }],
    ["another confirmation instant", { confirmedAt: new Date("2026-09-19T11:58:00.000Z") }],
    ["a session", { sessionId: session }],
    ["an incentive declared", { declared: { kind: "percent", value: 0.05 } }],
  ])("%s is different content", (_name, over) => {
    expect(valid().sameContentAs(valid(over))).toBe(false);
  });

  it("another incentive value is different content; the same incentive is the same", () => {
    const five = valid({ declared: { kind: "percent", value: 0.05 } });
    expect(five.sameContentAs(valid({ declared: { kind: "percent", value: 10 } }))).toBe(false);
    expect(five.sameContentAs(valid({ declared: { kind: "percent", value: 0.05 } }))).toBe(true);
  });

  it("another orderId is different content (the ledger never compares across identities, but the rule holds)", () => {
    expect(valid().sameContentAs(valid({ orderId: asOrderId("A-2") }))).toBe(false);
  });
});

describe("Order — the record, the return and the lines", () => {
  it("record() carries every fact and everything derived, and rehydrate round-trips it", () => {
    const correlation = Correlation.rehydrate({ sessionId: asSessionId("s"), visitorId: asVisitorId("v") });
    const redemption = IncentiveRedemption.rehydrate({
      verdict: "not-granted",
      declared: { kind: "percent", value: 0.05 },
    });
    const returned = Return.rehydrate({ orderId: base.orderId, returnedAt: NOW, receivedAt: NOW });
    const order = Order.rehydrate({
      ...valid({
        sessionId: asSessionId("ses_00000001"),
        declared: { kind: "percent", value: 0.05 },
      }).record(),
      correlation,
      redemption,
    }).withReturn(returned);
    const record = order.record();
    expect(record).toMatchObject({
      sessionId: "ses_00000001",
      declared: { kind: "percent", value: 0.05 },
      correlation,
      redemption,
      returned,
    });
    const again = Order.rehydrate(record);
    expect(again.sameContentAs(order)).toBe(true);
    // Equal by value and not by reference: the constructor builds every part from its record (feature 037).
    expect(again.correlation).toEqual(correlation);
    expect(again.redemption).toEqual(redemption);
    expect(again.returned).toEqual(returned);
    const bare = valid().record();
    expect(bare.sessionId).toBeUndefined();
    expect(bare.declared).toBeUndefined();
    expect(bare.correlation).toBeUndefined();
    expect(bare.redemption).toBeUndefined();
    expect(bare.returned).toBeUndefined();
  });

  it("correlated attaches what OPE derived and nothing else; without a correlation the order stays pending", () => {
    const correlation = Correlation.rehydrate({ sessionId: asSessionId("s"), visitorId: asVisitorId("v") });
    const attributed = valid().correlated(correlation, undefined);
    // By value: a copy rebuilds its parts from their records (feature 037).
    expect(attributed.correlation).toEqual(correlation);
    expect(attributed.redemption).toBeUndefined();
    expect(attributed.status()).toBe("ATTRIBUTED_ORDER");
    expect(attributed.correlationStatus()).toBe("ATTRIBUTED");
    expect(attributed.sameContentAs(valid())).toBe(true);
    const pending = valid().correlated(undefined, undefined);
    expect(pending.correlation).toBeUndefined();
    expect(pending.status()).toBe("VERIFIED_ORDER");
    expect(pending.correlationStatus()).toBe("PENDING_CORRELATION");
  });

  it("withReturn keeps everything and adds the return; the status becomes RETURNED and the correlation stays", () => {
    const correlation = Correlation.rehydrate({ sessionId: asSessionId("s"), visitorId: asVisitorId("v") });
    const order = Order.rehydrate({ ...valid().record(), correlation });
    const returned = order.withReturn(
      Return.rehydrate({ orderId: base.orderId, returnedAt: NOW, receivedAt: NOW }),
    );
    expect(returned.returned?.returnedAt).toEqual(NOW);
    expect(returned.correlation).toEqual(correlation);
    expect(returned.status()).toBe("RETURNED");
    expect(returned.correlationStatus()).toBe("ATTRIBUTED");
    expect(order.returned).toBeUndefined();
    expect(order.status()).toBe("ATTRIBUTED_ORDER");
    const pendingReturned = valid().withReturn(
      Return.rehydrate({ orderId: base.orderId, returnedAt: NOW, receivedAt: NOW }),
    );
    expect(pendingReturned.status()).toBe("RETURNED");
    expect(pendingReturned.correlationStatus()).toBe("PENDING_CORRELATION");
  });

  it("contains: the SKU with at least that many units", () => {
    const order = valid();
    expect(order.contains({ sku: "SKU-1", quantity: 2 })).toBe(true);
    expect(order.contains({ sku: "SKU-1", quantity: 3 })).toBe(false);
    expect(order.contains({ sku: "SKU-9", quantity: 1 })).toBe(false);
  });

  it("canonicalItems sorts by SKU without touching the input", () => {
    const items = [
      { sku: "b", quantity: 1 },
      { sku: "a", quantity: 2 },
    ];
    expect(Order.canonicalItems(items)).toEqual([
      { sku: "a", quantity: 2 },
      { sku: "b", quantity: 1 },
    ]);
    expect(items[0]?.sku).toBe("b");
    expect(Order.duplicatedSku(items)).toBeUndefined();
  });
});

describe("Order from a plain record (feature 037: the record declares data, the constructor converts)", () => {
  /** Exactly what a store gives back: object literals, no instance anywhere. */
  const plain: OrderRecord = {
    merchantId: asMerchantId("m_a"),
    orderId: asOrderId("A-9"),
    total: { amount: "100.00", currency: "ARS" },
    items: [{ sku: "SKU-1", quantity: 2 }],
    confirmedAt: new Date("2026-09-19T11:59:00.000Z"),
    receivedAt: NOW,
    correlation: { sessionId: asSessionId("s"), visitorId: asVisitorId("v") },
    redemption: { verdict: "not-granted", declared: { kind: "percent", value: 0.05 } },
    returned: { orderId: asOrderId("A-9"), returnedAt: NOW, receivedAt: NOW },
  };

  it("turns every part into its class, so each one answers its own rules", () => {
    const order = Order.rehydrate(plain);
    expect(order.total.equals(Money.rehydrate({ amount: "100.00", currency: "ARS" }))).toBe(true);
    expect(order.correlation).toBeInstanceOf(Correlation);
    expect(order.redemption).toBeInstanceOf(IncentiveRedemption);
    const repeated = Return.rehydrate({
      orderId: asOrderId("A-9"),
      returnedAt: NOW,
      receivedAt: new Date(NOW.getTime() + 1),
    });
    expect(order.returned?.sameContentAs(repeated)).toBe(true);
    expect(order.status()).toBe("RETURNED");
  });

  it("built from a copy is the same as built from the plain record: converting an instance is idempotent", () => {
    const copied = Order.rehydrate({ ...plain, returned: undefined }).withReturn(
      Return.rehydrate({ orderId: asOrderId("A-9"), returnedAt: NOW, receivedAt: NOW }),
    );
    const direct = Order.rehydrate(plain);
    expect(copied).toEqual(direct);
    expect(copied.sameContentAs(direct)).toBe(true);
    expect(copied.record()).toEqual(direct.record());
  });

  it("leaves an absent optional part absent instead of inventing one", () => {
    const order = Order.rehydrate({
      ...plain,
      correlation: undefined,
      redemption: undefined,
      returned: undefined,
    });
    expect(order.correlation).toBeUndefined();
    expect(order.redemption).toBeUndefined();
    expect(order.returned).toBeUndefined();
    expect(order.correlationStatus()).toBe("PENDING_CORRELATION");
  });
});
