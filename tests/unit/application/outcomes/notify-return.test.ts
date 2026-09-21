// Feature 013, user stories 3 and 4 (FR-030..FR-038; ADR-021): the corroboration and return
// use cases with fakes — evidence that never creates an order, the return against the order's
// lines, the ledger's outcomes and the ledger down.
import { describe, expect, it } from "vitest";
import {
  CorroborateOrderUseCase,
  NotifyReturnUseCase,
  type OrderLedger,
} from "../../../../src/application/outcomes/index.js";
import { LedgerUnavailable } from "../../../../src/domain/ledger/index.js";
import { asOrderId, Order } from "../../../../src/domain/outcomes/index.js";
import {
  asMerchantId,
  asSessionId,
  asVisitorId,
  fail,
  Money,
  ok,
} from "../../../../src/domain/shared-kernel/index.js";
import { memoryCorroborationLedger } from "../../../../src/interface-adapters/gateways/outcomes/memory-corroboration-ledger.js";
import { memoryOrderLedger } from "../../../../src/interface-adapters/gateways/outcomes/memory-order-ledger.js";
import { TEST_TOLERANCE } from "../../../helpers/platform.js";
import {
  unavailableCorroborationLedger,
  unavailableOrderLedger,
} from "../../../helpers/unavailable-ledgers.js";

const A = asMerchantId("m_a");
const B = asMerchantId("m_b");
const NOW = new Date("2026-09-19T12:00:00.000Z");
const ID = asOrderId("A-1");
const clock = { now: () => NOW };

describe("CorroborateOrderUseCase", () => {
  const request = {
    merchantId: A,
    orderId: ID,
    sessionId: asSessionId("ses_00000001"),
    visitorId: asVisitorId("vis_00000001"),
    confirmedAt: new Date("2026-09-19T11:59:58.000Z"),
  };

  it("records the corroboration with the receipt instant; repeated is repeated", async () => {
    const corroborations = memoryCorroborationLedger();
    const useCase = new CorroborateOrderUseCase({ clock, tolerance: TEST_TOLERANCE, corroborations });
    expect(await useCase.execute(request)).toEqual({
      ok: true,
      value: { receivedAt: NOW, status: "recorded" },
    });
    expect(await useCase.execute(request)).toEqual({
      ok: true,
      value: { receivedAt: NOW, status: "repeated" },
    });
    expect(await corroborations.find(A, ID)).toHaveLength(1);
  });

  it("a browser instant beyond the tolerance → corroboration-confirmed-in-future, nothing recorded", async () => {
    const corroborations = memoryCorroborationLedger();
    const useCase = new CorroborateOrderUseCase({ clock, tolerance: TEST_TOLERANCE, corroborations });
    const result = await useCase.execute({ ...request, confirmedAt: new Date("2026-09-19T12:05:01.000Z") });
    expect(result.ok ? undefined : result.error.code).toBe("corroboration-confirmed-in-future");
    expect(await corroborations.find(A, ID)).toHaveLength(0);
  });

  it("the ledger down → ledger-unavailable", async () => {
    const useCase = new CorroborateOrderUseCase({
      clock,
      tolerance: TEST_TOLERANCE,
      corroborations: unavailableCorroborationLedger(),
    });
    const result = await useCase.execute(request);
    expect(result.ok ? undefined : result.error).toBeInstanceOf(LedgerUnavailable);
  });
});

describe("NotifyReturnUseCase", () => {
  const recorded = Order.rehydrate({
    merchantId: A,
    orderId: ID,
    total: Money.rehydrate({ amount: "10.00", currency: "ARS" }),
    items: [{ sku: "SKU-1", quantity: 2 }],
    confirmedAt: NOW,
    receivedAt: NOW,
  });
  const request = { merchantId: A, orderId: ID, returnedAt: new Date("2026-09-24T08:30:00.000Z") };

  async function withOrder(orders: OrderLedger = memoryOrderLedger()) {
    await orders.record(recorded);
    return { orders, useCase: new NotifyReturnUseCase({ clock, orders }) };
  }

  it("created with the returned order, then repeated; a different return conflicts", async () => {
    const { useCase, orders } = await withOrder();
    const first = await useCase.execute(request);
    expect(first.ok && first.value.outcome).toBe("created");
    expect(first.ok && first.value.order.returned?.receivedAt).toEqual(NOW);
    const again = await useCase.execute(request);
    expect(again.ok && again.value.outcome).toBe("repeated");
    const other = await useCase.execute({ ...request, items: [{ sku: "SKU-1", quantity: 1 }] });
    expect(other.ok ? undefined : other.error.code).toBe("idempotency-conflict");
    expect((await orders.find(A, ID))?.returned?.items).toBeUndefined();
  });

  it("an unknown order, or the order of another merchant → order-unknown", async () => {
    const { useCase } = await withOrder();
    const unknown = await useCase.execute({ ...request, orderId: asOrderId("Z-9") });
    expect(unknown.ok ? undefined : unknown.error.code).toBe("order-unknown");
    const foreign = await useCase.execute({ ...request, merchantId: B });
    expect(foreign.ok ? undefined : foreign.error.code).toBe("order-unknown");
  });

  it("items the order did not have → return-items-not-in-order, nothing recorded", async () => {
    const { useCase, orders } = await withOrder();
    const result = await useCase.execute({ ...request, items: [{ sku: "SKU-1", quantity: 3 }] });
    expect(result.ok ? undefined : result.error.code).toBe("return-items-not-in-order");
    expect((await orders.find(A, ID))?.returned).toBeUndefined();
  });

  it("the ledger down at the write → ledger-unavailable; a ledger that lost the order between find and write → order-unknown", async () => {
    const inner = memoryOrderLedger();
    const { useCase } = await withOrder({
      ...inner,
      recordReturn: () => Promise.resolve(fail(new LedgerUnavailable())),
    });
    const down = await useCase.execute(request);
    expect(down.ok ? undefined : down.error).toBeInstanceOf(LedgerUnavailable);
    const raced = new NotifyReturnUseCase({
      clock,
      orders: { ...inner, recordReturn: () => Promise.resolve(ok({ outcome: "unknown" })) },
    });
    const lost = await raced.execute(request);
    expect(lost.ok ? undefined : lost.error.code).toBe("order-unknown");
    const nothing = new NotifyReturnUseCase({ clock, orders: unavailableOrderLedger() });
    const absent = await nothing.execute(request);
    expect(absent.ok ? undefined : absent.error.code).toBe("order-unknown");
  });
});
