// Feature 013, user story 4 (FR-035..FR-038): the platform reports the return of a recorded
// order — RETURNED keeping the correlation, idempotent by orderId, rejected when the order is
// unknown to the merchant or the items were not bought.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { replace } from "../../src/composition/graph/index.js";
import { OrderLedgerPort } from "../../src/composition/modules/outcomes.js";
import { ClockPort } from "../../src/composition/modules/shared-kernel.js";
import { LedgerUnavailable } from "../../src/domain/ledger/index.js";
import { fail, type MerchantId } from "../../src/domain/shared-kernel/index.js";
import { memoryOrderLedger } from "../../src/interface-adapters/outcomes/gateways/memory-order-ledger.js";
import { json } from "../helpers/json.js";
import {
  eventOf,
  orderOf,
  postEvents,
  postOrder,
  postReturn,
  sharedTestApp,
  type SharedApp,
} from "../helpers/test-app.js";
import type { OrderLedger } from "../../src/application/outcomes/index.js";
import type { OrderId } from "../../src/domain/outcomes/index.js";

const NOW = "2026-09-18T12:00:00.000Z";
const LATER = "2026-09-24T09:00:00.000Z";
const KEY_A = "key-a-1";
const PLATFORM_A = "platform-a-1";
const PLATFORM_B = "platform-b-1";
const SESSION = "ses_00000001";
const A = "m_a" as MerchantId;

const returnOf = (orderId: string, over: Record<string, unknown> = {}): Record<string, unknown> => ({
  orderId,
  returnedAt: "2026-09-24T08:30:00.000Z",
  ...over,
});

let now = new Date(NOW);
// One server per file (015 F-055): the in-memory ports are rebuilt before each test.
let app: SharedApp;
beforeAll(async () => {
  app = await sharedTestApp({ ports: [replace(ClockPort, { now: () => now })] });
});
beforeEach(async () => {
  await app.resetPorts();
});
afterAll(async () => {
  await app.close();
});

const find = (orderId: string) => app.resolve(OrderLedgerPort).find(A, orderId as OrderId);

async function startWithOrder(options: { attributed?: boolean; orders?: OrderLedger } = {}): Promise<void> {
  now = new Date(NOW);
  await app.resetPorts(
    options.orders === undefined ? {} : { ports: [replace(OrderLedgerPort, options.orders)] },
  );
  if (options.attributed)
    await postEvents(
      app.app,
      { events: [eventOf(1, { occurredAt: "2026-09-18T11:59:00.000Z" })] },
      { key: KEY_A },
    );
  const res = await postOrder(
    app.app,
    orderOf("A-1", {
      items: [
        { sku: "SKU-1-M", quantity: 2 },
        { sku: "SKU-2", quantity: 1 },
      ],
      ...(options.attributed ? { sessionId: SESSION } : {}),
    }),
    { platformKey: PLATFORM_A },
  );
  expect(res.statusCode).toBe(201);
}

describe("notifyReturn — user story 4", () => {
  it("1. an attributed order returned → 201 RETURNED; the ledger keeps the correlation and the return", async () => {
    await startWithOrder({ attributed: true });
    now = new Date(LATER);
    const res = await postReturn(app.app, returnOf("A-1", { items: [{ sku: "SKU-1-M", quantity: 1 }] }), {
      platformKey: PLATFORM_A,
    });
    expect(res.statusCode).toBe(201);
    expect(json(res)).toEqual({
      orderId: "A-1",
      status: "RETURNED",
      correlation: "ATTRIBUTED",
      receivedAt: LATER,
    });
    const order = await find("A-1");
    expect(order?.correlation?.sessionId).toBe(SESSION);
    expect(order?.returned).toMatchObject({
      returnedAt: new Date("2026-09-24T08:30:00.000Z"),
      items: [{ sku: "SKU-1-M", quantity: 1 }],
    });
  });

  it("a pending order returned keeps saying pending", async () => {
    await startWithOrder();
    const res = await postReturn(app.app, returnOf("A-1"), { platformKey: PLATFORM_A });
    expect(json(res)).toMatchObject({ status: "RETURNED", correlation: "PENDING_CORRELATION" });
  });

  it("a repeat of an order returned since answers RETURNED with the correlation it had", async () => {
    await startWithOrder();
    await postReturn(app.app, returnOf("A-1"), { platformKey: PLATFORM_A });
    const again = await postOrder(
      app.app,
      orderOf("A-1", {
        items: [
          { sku: "SKU-1-M", quantity: 2 },
          { sku: "SKU-2", quantity: 1 },
        ],
      }),
      { platformKey: PLATFORM_A },
    );
    expect(again.statusCode).toBe(200);
    expect(json(again)).toMatchObject({ status: "RETURNED", correlation: "PENDING_CORRELATION" });
  });

  it("2. repeated → 200; a different one (other items, other instant) → 409 and the first stays", async () => {
    await startWithOrder();
    const body = returnOf("A-1", { items: [{ sku: "SKU-2", quantity: 1 }] });
    expect((await postReturn(app.app, body, { platformKey: PLATFORM_A })).statusCode).toBe(201);
    expect((await postReturn(app.app, body, { platformKey: PLATFORM_A })).statusCode).toBe(200);
    for (const change of [
      { items: [{ sku: "SKU-1-M", quantity: 1 }] },
      { returnedAt: "2026-09-25T08:30:00.000Z" },
    ]) {
      const res = await postReturn(app.app, returnOf("A-1", change), { platformKey: PLATFORM_A });
      expect(res.statusCode).toBe(409);
      expect(json(res)).toMatchObject({ type: "urn:ope:problem:idempotency-conflict" });
    }
    expect((await find("A-1"))?.returned?.items).toEqual([{ sku: "SKU-2", quantity: 1 }]);
  });

  it("3. [invariant:order-unknown] an order OPE never recorded → 422 and nothing recorded", async () => {
    await startWithOrder();
    const res = await postReturn(app.app, returnOf("Z-9"), { platformKey: PLATFORM_A });
    expect(res.statusCode).toBe(422);
    expect(json(res)).toMatchObject({ type: "urn:ope:problem:order-unknown" });
  });

  it("4. an order that exists only for another merchant → 422 order-unknown", async () => {
    await startWithOrder();
    const res = await postReturn(app.app, returnOf("A-1"), { platformKey: PLATFORM_B });
    expect(res.statusCode).toBe(422);
    expect(json(res)).toMatchObject({ type: "urn:ope:problem:order-unknown" });
    expect((await find("A-1"))?.returned).toBeUndefined();
  });

  it("5. [invariant:return-items-not-in-order] a SKU the order did not have, more units than bought, or a repeated SKU → 422", async () => {
    await startWithOrder();
    for (const items of [
      [{ sku: "SKU-9", quantity: 1 }],
      [{ sku: "SKU-1-M", quantity: 3 }],
      [
        { sku: "SKU-1-M", quantity: 1 },
        { sku: "SKU-1-M", quantity: 1 },
      ],
    ]) {
      const res = await postReturn(app.app, returnOf("A-1", { items }), { platformKey: PLATFORM_A });
      expect(res.statusCode).toBe(422);
      expect(json(res)).toMatchObject({ type: "urn:ope:problem:return-items-not-in-order" });
    }
    expect((await find("A-1"))?.returned).toBeUndefined();
  });

  it("ledger unavailable at the write → 503 with Retry-After; the order stays as it was", async () => {
    const inner = memoryOrderLedger();
    await startWithOrder({
      orders: { ...inner, recordReturn: () => Promise.resolve(fail(new LedgerUnavailable())) },
    });
    const res = await postReturn(app.app, returnOf("A-1"), { platformKey: PLATFORM_A });
    expect(res.statusCode).toBe(503);
    expect(res.headers["retry-after"]).toBeDefined();
    expect((await find("A-1"))?.returned).toBeUndefined();
  });
});
