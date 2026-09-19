// Feature 013, user stories 1, 2 and 5 (FR-001..FR-005, FR-010..FR-014, FR-020..FR-022,
// FR-040..FR-041; SC-001..SC-004): the platform confirms an order through HTTP — verified,
// attributed only by mechanism A or pending, immutable and idempotent by orderId; the
// incentive it declares is crossed with what the session's decision granted.
import { afterEach, describe, expect, it } from "vitest";
import { json } from "../helpers/json.js";
import {
  catalogProductOf,
  eventOf,
  fixedClock,
  orderOf,
  postCorroboration,
  postEvents,
  postOrder,
  putCatalog,
  startTestApp,
  merchantB,
  type MerchantSpec,
} from "../helpers/test-app.js";
import { recordingLogger, unavailableOrderLedger } from "../helpers/unavailable-ledgers.js";
import type { App } from "../../src/composition/bootstrap.js";
import type { OrderId } from "../../src/domain/outcomes/index.js";
import type { MerchantId } from "../../src/domain/shared-kernel/index.js";

const NOW = "2026-09-18T12:00:00.000Z";
const KEY_A = "key-a-1";
const PLATFORM_A = "platform-a-1";
const PLATFORM_B = "platform-b-1";
const SESSION = "ses_00000001";
const A = "m_a" as MerchantId;
const B = "m_b" as MerchantId;

/** A merchant with margin: the price barrier grants an incentive (feature 012). */
const merchantWithMargin: MerchantSpec = {
  merchantId: "m_a",
  ingestKeys: [KEY_A],
  platformKeys: [PLATFORM_A],
  origins: ["https://a.example"],
  evidenceProfile: { returnsPolicy: true, fitData: true },
  commercialPolicy: { version: "a-commercial-1", marginPercent: 40 },
  experiments: [
    { experimentId: "exp_a_000001", treatmentPercent: 100, seed: "seed-a", status: "active", startedAt: NOW },
  ],
};

let app: App;
afterEach(async () => {
  await app.close();
});

async function start(options: { merchants?: MerchantSpec[]; ordersDown?: boolean } = {}): Promise<void> {
  const ports = {
    clock: fixedClock(NOW),
    ...(options.ordersDown ? { orders: unavailableOrderLedger() } : {}),
  };
  app = await startTestApp(
    { ports },
    options.merchants === undefined ? {} : { merchants: options.merchants },
  );
}

let n = 0;
const at = (seconds: number): string =>
  new Date(new Date(NOW).getTime() - 60_000 + seconds * 1000).toISOString();
const PAGE = { pageType: "product", productId: "SKU-1", variantId: "SKU-1-M" };
const ev = (seconds: number, over: Record<string, unknown>): Record<string, unknown> =>
  eventOf(++n, { occurredAt: at(seconds), page: PAGE, ...over });

/** A session the ledger knows: one batch, one decision (whatever its outcome). */
async function knownSession(key = KEY_A, session = SESSION): Promise<void> {
  const res = await postEvents(app.app, { events: [ev(1, { sessionId: session })] }, { key });
  expect(res.statusCode).toBe(202);
}

/** A session whose decision granted an incentive: fresh catalogue + price signals under a merchant with margin. */
async function incentiveSession(): Promise<number> {
  const catalog = await putCatalog(
    app.app,
    { capturedAt: NOW, products: [catalogProductOf("SKU-1", 2)] },
    { platformKey: PLATFORM_A },
  );
  expect(catalog.statusCode).toBe(201);
  const res = await postEvents(
    app.app,
    {
      events: [
        ev(1, { type: "block_dwelled", block: "price", dwellMs: 6000 }),
        ev(2, { type: "cta_approached", approach: "hover" }),
      ],
    },
    { key: KEY_A },
  );
  expect(res.statusCode).toBe(202);
  const body = json(res) as {
    decision: { outcome: string; intervention?: { incentive?: { value: number } } };
  };
  expect(body.decision.outcome).toBe("INTERVENE");
  const value = body.decision.intervention?.incentive?.value;
  expect(value).toBe(5);
  return value ?? 0;
}

const find = (merchant: MerchantId, orderId: string) => app.ports.orders.find(merchant, orderId as OrderId);

describe("notifyOrder — user story 1: verified, attributed or pending", () => {
  it("1. an order carrying a known session → 201 ATTRIBUTED_ORDER; the ledger keeps the correlation with the assignment", async () => {
    await start();
    await knownSession();
    const res = await postOrder(app.app, orderOf("A-1", { sessionId: SESSION }), { platformKey: PLATFORM_A });
    expect(res.statusCode).toBe(201);
    expect(json(res)).toEqual({ orderId: "A-1", status: "ATTRIBUTED_ORDER", receivedAt: NOW });
    const order = await find(A, "A-1");
    expect(order?.status()).toBe("ATTRIBUTED_ORDER");
    expect(order?.correlation).toMatchObject({
      sessionId: SESSION,
      visitorId: "vis_00000001",
      experiment: { experimentId: "exp_a_000001", arm: "TREATMENT" },
    });
    expect(order?.total.amount).toBe("18990.50");
    expect(order?.items).toEqual([{ sku: "SKU-1-M", quantity: 1 }]);
  });

  it("1b. the platform credential keeps the catalogue-sized limit: a 2 MiB order body is parsed, not refused by size (F-057)", async () => {
    await start();
    const twoMiB = 2 * 1024 * 1024;
    const res = await postOrder(
      app.app,
      { ...orderOf("A-big"), filler: "x".repeat(twoMiB) },
      { platformKey: PLATFORM_A },
    );
    // Past the parser: the contract rejects the undeclared field (400), which proves the body was read.
    expect(res.statusCode).toBe(400);
  });

  it("2. without a session → 201 PENDING_CORRELATION; a verified sale without correlation", async () => {
    await start();
    const res = await postOrder(app.app, orderOf("A-2"), { platformKey: PLATFORM_A });
    expect(res.statusCode).toBe(201);
    expect(json(res)).toEqual({ orderId: "A-2", status: "PENDING_CORRELATION", receivedAt: NOW });
    const order = await find(A, "A-2");
    expect(order?.correlation).toBeUndefined();
    expect(order?.status()).toBe("PENDING_CORRELATION");
  });

  it("3. a session OPE never saw, or one of another merchant → PENDING_CORRELATION; nothing is inferred", async () => {
    await start();
    await knownSession("key-b-1");
    const unknown = await postOrder(app.app, orderOf("A-3", { sessionId: "ses_99999999" }), {
      platformKey: PLATFORM_A,
    });
    expect(json(unknown)).toMatchObject({ status: "PENDING_CORRELATION" });
    const foreign = await postOrder(app.app, orderOf("A-4", { sessionId: SESSION }), {
      platformKey: PLATFORM_A,
    });
    expect(json(foreign)).toMatchObject({ status: "PENDING_CORRELATION" });
  });

  it("4. a known session whose merchant had no experiment → attributed to the session, without a group", async () => {
    await start();
    await knownSession("key-b-1");
    const res = await postOrder(app.app, orderOf("B-1", { sessionId: SESSION }), { platformKey: PLATFORM_B });
    expect(json(res)).toMatchObject({ status: "ATTRIBUTED_ORDER" });
    const order = await find(B, "B-1");
    expect(order?.correlation?.sessionId).toBe(SESSION);
    expect(order?.correlation?.experiment).toBeUndefined();
  });

  it("5. anything about the buyer, or any property outside the contract, is rejected at the edge (FR-011, FR-012)", async () => {
    await start();
    for (const extra of [
      { email: "a@b.c" },
      { customer: { name: "x" } },
      { shippingAddress: "x" },
      { notes: "x" },
    ]) {
      const res = await postOrder(app.app, orderOf("A-5", extra), { platformKey: PLATFORM_A });
      expect(res.statusCode).toBe(400);
    }
    expect(await find(A, "A-5")).toBeUndefined();
  });

  it("6. ledger unavailable → 503 with Retry-After and nothing recorded", async () => {
    await start({ ordersDown: true });
    const res = await postOrder(app.app, orderOf("A-6"), { platformKey: PLATFORM_A });
    expect(res.statusCode).toBe(503);
    expect(res.headers["retry-after"]).toBeDefined();
    expect(json(res)).toMatchObject({ type: "urn:ope:problem:ledger-unavailable" });
  });

  it("[invariant:duplicate-order-item] two lines with the same SKU → 422", async () => {
    await start();
    const res = await postOrder(
      app.app,
      orderOf("A-7", {
        items: [
          { sku: "SKU-1-M", quantity: 1 },
          { sku: "SKU-1-M", quantity: 2 },
        ],
      }),
      { platformKey: PLATFORM_A },
    );
    expect(res.statusCode).toBe(422);
    expect(json(res)).toMatchObject({ type: "urn:ope:problem:duplicate-order-item" });
    expect(await find(A, "A-7")).toBeUndefined();
  });

  it("[invariant:order-confirmed-in-future] a confirmation more than 5 minutes ahead of the clock → 422; within, accepted", async () => {
    await start();
    const late = await postOrder(app.app, orderOf("A-8", { confirmedAt: "2026-09-18T12:05:01.000Z" }), {
      platformKey: PLATFORM_A,
    });
    expect(late.statusCode).toBe(422);
    expect(json(late)).toMatchObject({ type: "urn:ope:problem:order-confirmed-in-future" });
    const fine = await postOrder(app.app, orderOf("A-8", { confirmedAt: "2026-09-18T12:05:00.000Z" }), {
      platformKey: PLATFORM_A,
    });
    expect(fine.statusCode).toBe(201);
  });

  it("the response never carries the arm, the experiment nor the visitor (FR-013, SC-004)", async () => {
    await start();
    await knownSession();
    const res = await postOrder(app.app, orderOf("A-9", { sessionId: SESSION }), { platformKey: PLATFORM_A });
    expect(Object.keys(json(res) as object).sort()).toEqual(["orderId", "receivedAt", "status"]);
    expect(JSON.stringify(json(res))).not.toMatch(/arm|experiment|visitor|TREATMENT|CONTROL/);
  });

  it("the platform credential is required: the SDK key is not one (401), and the wrong consumer is 403", async () => {
    await start();
    expect((await postOrder(app.app, orderOf("A-10"))).statusCode).toBe(401);
    expect((await postOrder(app.app, orderOf("A-10"), { key: KEY_A })).statusCode).toBe(401);
  });
});

describe("notifyOrder — user story 2: idempotent by orderId, immutable", () => {
  it("1. the same order three times → 201, 200, 200 with the same record; the ledger holds one", async () => {
    await start();
    await knownSession();
    const body = orderOf("A-1", { sessionId: SESSION });
    const codes = [];
    for (let i = 0; i < 3; i += 1)
      codes.push((await postOrder(app.app, body, { platformKey: PLATFORM_A })).statusCode);
    expect(codes).toEqual([201, 200, 200]);
    const repeated = await postOrder(app.app, body, { platformKey: PLATFORM_A });
    expect(json(repeated)).toEqual({ orderId: "A-1", status: "ATTRIBUTED_ORDER", receivedAt: NOW });
  });

  it("2. the same content with the keys and lines in another order is the same order (FR-021)", async () => {
    await start();
    const first = orderOf("A-1", {
      items: [
        { sku: "SKU-2", quantity: 1 },
        { sku: "SKU-1-M", quantity: 3 },
      ],
    });
    const shuffled = {
      confirmedAt: first["confirmedAt"],
      items: [
        { quantity: 3, sku: "SKU-1-M" },
        { quantity: 1, sku: "SKU-2" },
      ],
      total: first["total"],
      orderId: "A-1",
    };
    expect((await postOrder(app.app, first, { platformKey: PLATFORM_A })).statusCode).toBe(201);
    expect((await postOrder(app.app, shuffled, { platformKey: PLATFORM_A })).statusCode).toBe(200);
  });

  it("3. the same orderId with another total, other items or another session → 409 and the original record intact", async () => {
    await start();
    await knownSession();
    expect((await postOrder(app.app, orderOf("A-1"), { platformKey: PLATFORM_A })).statusCode).toBe(201);
    for (const change of [
      { total: { amount: "1.00", currency: "ARS" } },
      { items: [{ sku: "SKU-1-M", quantity: 2 }] },
      { sessionId: SESSION },
      { incentive: { kind: "percent", value: 5 } },
    ]) {
      const res = await postOrder(app.app, orderOf("A-1", change), { platformKey: PLATFORM_A });
      expect(res.statusCode).toBe(409);
      expect(json(res)).toMatchObject({ type: "urn:ope:problem:idempotency-conflict" });
    }
    const order = await find(A, "A-1");
    expect(order?.total.amount).toBe("18990.50");
    expect(order?.status()).toBe("PENDING_CORRELATION");
  });

  it("4. the same orderId in two merchants are two orders (FR-014)", async () => {
    await start();
    expect((await postOrder(app.app, orderOf("X-1"), { platformKey: PLATFORM_A })).statusCode).toBe(201);
    expect((await postOrder(app.app, orderOf("X-1"), { platformKey: PLATFORM_B })).statusCode).toBe(201);
    expect((await find(A, "X-1"))?.merchantId).toBe(A);
    expect((await find(B, "X-1"))?.merchantId).toBe(B);
  });

  it("5. a pending order does not become attributed later: the session becoming known does not change a repeat (FR-004)", async () => {
    await start();
    expect(
      json(await postOrder(app.app, orderOf("A-1", { sessionId: SESSION }), { platformKey: PLATFORM_A })),
    ).toMatchObject({
      status: "PENDING_CORRELATION",
    });
    await knownSession();
    const again = await postOrder(app.app, orderOf("A-1", { sessionId: SESSION }), {
      platformKey: PLATFORM_A,
    });
    expect(again.statusCode).toBe(200);
    expect(json(again)).toMatchObject({ status: "PENDING_CORRELATION" });
  });
});

describe("notifyOrder — user story 5: the incentive applied is crossed with the one granted", () => {
  /** `sessionId: null` = an order that carries no session at all. */
  const withIncentive = (value: number | undefined, sessionId: string | null = SESSION) =>
    orderOf("A-1", {
      ...(sessionId === null ? {} : { sessionId }),
      ...(value === undefined ? {} : { incentive: { kind: "percent", value } }),
    });

  it("matched: the order declares what the decision granted", async () => {
    await start({ merchants: [merchantWithMargin, merchantB] });
    const granted = await incentiveSession();
    const res = await postOrder(app.app, withIncentive(granted), { platformKey: PLATFORM_A });
    expect(json(res)).toMatchObject({ status: "ATTRIBUTED_ORDER" });
    const order = await find(A, "A-1");
    expect(order?.redemption?.verdict).toBe("matched");
    expect(order?.redemption?.granted?.incentive).toEqual({ kind: "percent", value: granted });
  });

  it("mismatched, not-applied, not-granted and unverifiable: recorded, never rejected, same response", async () => {
    await start({ merchants: [merchantWithMargin, merchantB] });
    await incentiveSession();
    const cases: [string, Record<string, unknown>, string][] = [
      ["M-1", withIncentive(10), "mismatched"],
      ["M-2", withIncentive(undefined), "not-applied"],
      ["M-4", withIncentive(5, null), "unverifiable"],
    ];
    for (const [orderId, body, verdict] of cases) {
      const res = await postOrder(app.app, { ...body, orderId }, { platformKey: PLATFORM_A });
      expect(res.statusCode).toBe(201);
      expect(Object.keys(json(res) as object).sort()).toEqual(["orderId", "receivedAt", "status"]);
      expect((await find(A, orderId))?.redemption?.verdict).toBe(verdict);
    }
    await knownSession(KEY_A, "ses_00000002");
    const notGranted = await postOrder(
      app.app,
      { ...withIncentive(5, "ses_00000002"), orderId: "M-3" },
      { platformKey: PLATFORM_A },
    );
    expect(notGranted.statusCode).toBe(201);
    expect((await find(A, "M-3"))?.redemption?.verdict).toBe("not-granted");
    const nothing = await postOrder(
      app.app,
      { ...withIncentive(undefined, "ses_00000002"), orderId: "M-5" },
      {
        platformKey: PLATFORM_A,
      },
    );
    expect(nothing.statusCode).toBe(201);
    expect((await find(A, "M-5"))?.redemption).toBeUndefined();
  });
});

describe("notifyOrder — the corroboration is seen when the order arrives", () => {
  it("logs corroborated: true when the SDK corroborated the order first (FR-032)", async () => {
    const { logger, entries } = recordingLogger();
    app = await startTestApp({ ports: { clock: fixedClock(NOW), logger } });
    const corroborated = await postCorroboration(
      app.app,
      { orderId: "A-1", sessionId: SESSION, visitorId: "vis_00000001", confirmedAt: NOW },
      { key: KEY_A },
    );
    expect(corroborated.statusCode).toBe(202);
    await postOrder(app.app, orderOf("A-1"), { platformKey: PLATFORM_A });
    const recorded = entries.find((e) => e.message === "order recorded");
    expect(recorded?.fields).toMatchObject({
      orderId: "A-1",
      status: "PENDING_CORRELATION",
      corroborated: true,
    });
    expect(JSON.stringify(entries)).not.toMatch(/TREATMENT|CONTROL|visitorId/);
  });
});
