// Feature 013 (FR-035..FR-038): a return only exists valid against its order — every line
// returned was bought, with no more units than bought, and no SKU repeats — and its content
// equality ignores the receipt instant and the order of the lines.
import { describe, expect, it } from "vitest";
import {
  asOrderId,
  Corroboration,
  Order,
  Return,
  ReturnItemsNotInOrder,
  type OrderItem,
} from "../../../../src/domain/outcomes/index.js";
import { asMerchantId, asSessionId, asVisitorId, Money } from "../../../../src/domain/shared-kernel/index.js";

const NOW = new Date("2026-09-24T09:00:00.000Z");
const order = Order.rehydrate({
  merchantId: asMerchantId("m_a"),
  orderId: asOrderId("A-1"),
  total: Money.rehydrate({ amount: "100.00", currency: "ARS" }),
  items: [
    { sku: "SKU-1", quantity: 2 },
    { sku: "SKU-2", quantity: 1 },
  ],
  confirmedAt: new Date("2026-09-19T12:00:00.000Z"),
  receivedAt: new Date("2026-09-19T12:00:01.000Z"),
});
const returnedAt = new Date("2026-09-24T08:30:00.000Z");
const of = (items?: OrderItem[]) =>
  Return.of(order, { returnedAt, ...(items === undefined ? {} : { items }), receivedAt: NOW });

describe("Return.of", () => {
  it("without items: the whole order came back", () => {
    const built = of();
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(built.value.orderId).toBe("A-1");
      expect(built.value.items).toBeUndefined();
    }
  });

  it("items that are lines of the order, with at most the units bought", () => {
    const built = of([
      { sku: "SKU-2", quantity: 1 },
      { sku: "SKU-1", quantity: 2 },
    ]);
    expect(built.ok).toBe(true);
  });

  it.each<[string, OrderItem[]]>([
    ["a SKU the order did not have", [{ sku: "SKU-9", quantity: 1 }]],
    ["more units than bought", [{ sku: "SKU-1", quantity: 3 }]],
    [
      "a repeated SKU",
      [
        { sku: "SKU-1", quantity: 1 },
        { sku: "SKU-1", quantity: 1 },
      ],
    ],
  ])("%s → return-items-not-in-order naming the SKU", (_name, items) => {
    const built = of(items);
    expect(built.ok).toBe(false);
    if (!built.ok) {
      expect(built.error).toBeInstanceOf(ReturnItemsNotInOrder);
      expect(built.error.code).toBe("return-items-not-in-order");
      expect(built.error.message).toContain(items[0]?.sku ?? "");
      expect(built.error.message).toContain("A-1");
    }
  });
});

describe("Return.sameContentAs", () => {
  const first = () => {
    const built = of([
      { sku: "SKU-2", quantity: 1 },
      { sku: "SKU-1", quantity: 1 },
    ]);
    if (!built.ok) throw new Error(built.error.message);
    return built.value;
  };

  it("same instant and same lines in another order, whatever the receipt → same", () => {
    const other = Return.rehydrate({
      orderId: asOrderId("A-1"),
      returnedAt,
      items: [
        { sku: "SKU-1", quantity: 1 },
        { sku: "SKU-2", quantity: 1 },
      ],
      receivedAt: new Date(NOW.getTime() + 1000),
    });
    expect(first().sameContentAs(other)).toBe(true);
  });

  it("another instant, other lines, or no lines at all → different", () => {
    const base = first();
    const record = { orderId: base.orderId, returnedAt: base.returnedAt, receivedAt: base.receivedAt };
    expect(
      base.sameContentAs(Return.rehydrate({ ...record, items: base.items ?? [], returnedAt: NOW })),
    ).toBe(false);
    expect(base.sameContentAs(Return.rehydrate({ ...record, items: [{ sku: "SKU-1", quantity: 1 }] }))).toBe(
      false,
    );
    expect(base.sameContentAs(Return.rehydrate({ orderId: base.orderId, returnedAt, receivedAt: NOW }))).toBe(
      false,
    );
  });
});

describe("Corroboration.of", () => {
  const record = {
    merchantId: asMerchantId("m_a"),
    orderId: asOrderId("A-1"),
    sessionId: asSessionId("ses_00000001"),
    visitorId: asVisitorId("vis_00000001"),
    confirmedAt: new Date("2026-09-19T12:04:00.000Z"),
    receivedAt: new Date("2026-09-19T12:00:00.000Z"),
  };

  it("accepts a browser instant within the tolerance and keeps every fact", () => {
    const built = Corroboration.of(record);
    expect(built.ok).toBe(true);
    if (built.ok) expect(built.value).toMatchObject(record);
  });

  it("a browser instant beyond the tolerance → corroboration-confirmed-in-future; exactly at it, accepted", () => {
    const built = Corroboration.of({ ...record, confirmedAt: new Date("2026-09-19T12:05:00.001Z") });
    expect(built.ok ? undefined : built.error.code).toBe("corroboration-confirmed-in-future");
    expect(Corroboration.of({ ...record, confirmedAt: new Date("2026-09-19T12:05:00.000Z") }).ok).toBe(true);
    expect(Corroboration.rehydrate(record)).toMatchObject(record);
  });
});
