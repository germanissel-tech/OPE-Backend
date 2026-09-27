// Orders, their corroborations and the assignments, across a restart. These three are where the
// economic figure and the evidence that sustains it live, so what is checked here is not only that
// the record comes back but that it comes back **able to answer**: an order whose money or whose
// return lost its class reads fine and then throws on the one write that matters.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  Corroboration,
  Order,
  Return,
  asOrderId,
  type OrderRecord,
} from "../../src/domain/outcomes/index.js";
import {
  Money,
  asExperimentId,
  asMerchantId,
  asSessionId,
  asVisitorId,
} from "../../src/domain/shared-kernel/index.js";
import { sqliteAssignmentLedger } from "../../src/interface-adapters/experiment/index.js";
import { sqliteCorroborationLedger, sqliteOrderLedger } from "../../src/interface-adapters/outcomes/index.js";
import { restartableStore, type Restartable } from "./store-fixture.js";
import type { Assignment } from "../../src/domain/experiment/index.js";

const NOW = new Date("2026-09-26T12:00:00.000Z");
const SKEW_MS = 5 * 60 * 1000;
const MERCHANT = asMerchantId("m-uno");
const OTHER = asMerchantId("m-dos");
const SESSION = asSessionId("ses_00000001");
const VISITOR = asVisitorId("vis_00000001");
const EXPERIMENT = asExperimentId("exp_1");

let fixture: Restartable;

beforeEach(() => {
  fixture = restartableStore();
});

afterEach(() => {
  fixture.dispose();
});

const orders = (): ReturnType<typeof sqliteOrderLedger> =>
  sqliteOrderLedger({ store: fixture.store, logger: fixture.logger });
const corroborations = (): ReturnType<typeof sqliteCorroborationLedger> =>
  sqliteCorroborationLedger({ store: fixture.store, logger: fixture.logger });
const assignments = (): ReturnType<typeof sqliteAssignmentLedger> =>
  sqliteAssignmentLedger({ store: fixture.store, logger: fixture.logger });

function orderOf(id: string, over: Partial<OrderRecord> = {}): Order {
  const built = Order.of(
    {
      merchantId: MERCHANT,
      orderId: asOrderId(id),
      total: Money.rehydrate({ amount: "100.00", currency: "ARS" }),
      items: [
        { sku: "SKU-1", quantity: 2 },
        { sku: "SKU-2", quantity: 1 },
      ],
      confirmedAt: new Date(NOW.getTime() - 60_000),
      receivedAt: NOW,
      sessionId: SESSION,
      ...over,
    },
    SKEW_MS,
  );
  if (!built.ok) throw new Error(built.error.message);
  return built.value;
}

function returnOf(order: Order, items?: readonly { sku: string; quantity: number }[]): Return {
  const built = Return.of(order, {
    returnedAt: NOW,
    receivedAt: NOW,
    ...(items === undefined ? {} : { items }),
  });
  if (!built.ok) throw new Error(built.error.message);
  return built.value;
}

function corroborationOf(orderId: string, sessionId = SESSION, merchantId = MERCHANT): Corroboration {
  const built = Corroboration.of(
    {
      merchantId,
      orderId: asOrderId(orderId),
      sessionId,
      visitorId: VISITOR,
      confirmedAt: new Date(NOW.getTime() - 1000),
      receivedAt: NOW,
    },
    SKEW_MS,
  );
  if (!built.ok) throw new Error(built.error.message);
  return built.value;
}

const assignmentOf = (visitorId = VISITOR, merchantId = MERCHANT): Assignment => ({
  merchantId,
  experimentId: EXPERIMENT,
  visitorId,
  arm: "TREATMENT",
  assignedAt: NOW,
});

describe("the order ledger across a restart", () => {
  it("reads the order back with its money, its lines and its instants", async () => {
    const order = orderOf("A-1");
    expect(await orders().record(order)).toMatchObject({ ok: true, value: { outcome: "recorded" } });

    fixture.restart();

    const found = await orders().find(MERCHANT, asOrderId("A-1"));
    expect(found?.total).toBeInstanceOf(Money);
    // Not just the same figure: the same object able to compare itself, which is what the
    // reporting does with it.
    expect(found?.total.equals(order.total)).toBe(true);
    expect(found?.items).toEqual(order.items);
    expect(found?.confirmedAt).toBeInstanceOf(Date);
    expect(found?.status()).toBe("VERIFIED_ORDER");
  });

  it("calls the same notification a repeat, and a different one a conflict, after the restart", async () => {
    await orders().record(orderOf("A-2"));

    fixture.restart();

    expect(await orders().record(orderOf("A-2"))).toMatchObject({
      ok: true,
      value: { outcome: "repeated" },
    });
    const conflicting = await orders().record(
      orderOf("A-2", { total: Money.rehydrate({ amount: "999.00", currency: "ARS" }) }),
    );
    expect(conflicting).toMatchObject({ ok: true, value: { outcome: "conflict" } });
    // The one held answers: a conflict never quietly replaces the first record.
    expect(conflicting.ok && conflicting.value.order.total.amount).toBe("100.00");
  });

  it("records a return after the restart, and calls a repeated one a repeat", async () => {
    const order = orderOf("A-3");
    await orders().record(order);

    fixture.restart();

    const returned = returnOf(order, [{ sku: "SKU-1", quantity: 1 }]);
    expect(await orders().recordReturn(MERCHANT, asOrderId("A-3"), returned)).toMatchObject({
      ok: true,
      value: { outcome: "recorded" },
    });

    fixture.restart();

    const found = await orders().find(MERCHANT, asOrderId("A-3"));
    expect(found?.status()).toBe("RETURNED");
    // The return has to come back a `Return`, not the plain object JSON produced: comparing a
    // repeat is a method on it, and without the class this is where it would throw.
    expect(found?.returned).toBeInstanceOf(Return);
    expect(await orders().recordReturn(MERCHANT, asOrderId("A-3"), returned)).toMatchObject({
      ok: true,
      value: { outcome: "repeated" },
    });
  });

  it("says a return of an order it does not know is unknown", async () => {
    const order = orderOf("A-4");
    await orders().record(order);
    fixture.restart();

    expect(await orders().recordReturn(OTHER, asOrderId("A-4"), returnOf(order))).toEqual({
      ok: true,
      value: { outcome: "unknown" },
    });
  });

  it("shows a merchant nothing of another one, after the restart too", async () => {
    await orders().record(orderOf("A-5"));

    fixture.restart();

    expect(await orders().find(OTHER, asOrderId("A-5"))).toBeUndefined();
    // And the key being taken by one merchant does not stop the other from recording its own.
    expect(await orders().record(orderOf("A-5", { merchantId: OTHER }))).toMatchObject({
      ok: true,
      value: { outcome: "recorded" },
    });
  });

  it("degrades to the ledger's failure channel when the store refuses", async () => {
    fixture.makeUnavailable();

    const result = await orders().record(orderOf("A-6"));

    expect(result.ok).toBe(false);
    expect(fixture.logged[0]?.fields["write"]).toBe("order");
  });
});

describe("the corroboration ledger across a restart", () => {
  it("keeps the evidence of an order, in the order it was recorded", async () => {
    const ledger = corroborations();
    await ledger.record(corroborationOf("A-1", SESSION));
    await ledger.record(corroborationOf("A-1", asSessionId("ses_00000002")));

    fixture.restart();

    const found = await corroborations().find(MERCHANT, asOrderId("A-1"));
    expect(found.map((c) => c.sessionId)).toEqual(["ses_00000001", "ses_00000002"]);
    expect(found[0]).toBeInstanceOf(Corroboration);
    expect(found[0]?.confirmedAt).toBeInstanceOf(Date);
  });

  it("lets the first win across the restart", async () => {
    expect(await corroborations().record(corroborationOf("A-2"))).toEqual({ ok: true, value: "recorded" });

    fixture.restart();

    expect(await corroborations().record(corroborationOf("A-2"))).toEqual({ ok: true, value: "repeated" });
  });

  it("shows a merchant nothing of another one", async () => {
    await corroborations().record(corroborationOf("A-3", SESSION, MERCHANT));

    fixture.restart();

    expect(await corroborations().find(OTHER, asOrderId("A-3"))).toEqual([]);
  });
});

describe("the assignment ledger across a restart", () => {
  it("returns a visitor to the same arm, which is the point", async () => {
    await assignments().record(assignmentOf());

    fixture.restart();

    const found = await assignments().find(MERCHANT, EXPERIMENT, VISITOR);
    expect(found?.arm).toBe("TREATMENT");
    expect(found?.assignedAt).toBeInstanceOf(Date);
    expect(found?.assignedAt.getTime()).toBe(NOW.getTime());
  });

  it("keeps the first assignment when the same visitor is recorded again", async () => {
    await assignments().record(assignmentOf());

    fixture.restart();

    await assignments().record({ ...assignmentOf(), arm: "CONTROL" });
    expect((await assignments().find(MERCHANT, EXPERIMENT, VISITOR))?.arm).toBe("TREATMENT");
  });

  it("shows a merchant nothing of another one", async () => {
    await assignments().record(assignmentOf(VISITOR, MERCHANT));

    fixture.restart();

    expect(await assignments().find(OTHER, EXPERIMENT, VISITOR)).toBeUndefined();
  });

  it("degrades to the ledger's failure channel when the store refuses", async () => {
    fixture.makeUnavailable();

    expect((await assignments().record(assignmentOf())).ok).toBe(false);
    expect(fixture.logged[0]?.fields["write"]).toBe("assignment");
  });
});
