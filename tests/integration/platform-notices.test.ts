// Feature 044 — US3 (FR-007..FR-010; research R-06): the platform notices with its own credential, and OPE reads
// and records what it read. The whole server: the notice key minted by its rotation, the notice by HTTP, and the
// scheduler run with the test's clock reading the scripted test platform.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { replace } from "../../src/composition/graph/index.js";
import { OrderLedgerPort } from "../../src/composition/modules/outcomes.js";
import { InstalledSourcesPort, PlatformSchedulerPort } from "../../src/composition/modules/platform.js";
import { ClockPort } from "../../src/composition/modules/shared-kernel.js";
import { asOrderId } from "../../src/domain/outcomes/index.js";
import { asMerchantId } from "../../src/domain/shared-kernel/index.js";
import {
  installedSources,
  scriptedTestSource,
  type ScriptedTestSource,
} from "../../src/interface-adapters/platform/index.js";
import { json, problemOf } from "../helpers/json.js";
import { admin, sharedTestApp, type SharedApp } from "../helpers/test-app.js";

const START = new Date("2026-09-18T12:00:00.000Z");
const A = asMerchantId("m_a");
const PRICE = { amount: "123.00", currency: "ARS" };

let app: SharedApp;
let now = START;
let source: ScriptedTestSource;
const clock = { now: () => now };

beforeAll(async () => {
  app = await sharedTestApp({ ports: [replace(ClockPort, clock)] });
});
beforeEach(async () => {
  now = START;
  source = scriptedTestSource();
  await app.resetPorts({
    ports: [replace(InstalledSourcesPort, installedSources(new Map([["test", source]])))],
  });
});
afterAll(async () => {
  await app.close();
});

async function subscribe(merchant: string, over: Record<string, unknown> = {}): Promise<void> {
  const res = await admin(app.app, "POST", `/v1/admin/merchants/${merchant}/configuration`, {
    body: {
      declared: {
        platformSource: "test",
        syncStrategy: { orders: "subscribe", returns: "subscribe" },
        confirmedOrderStates: ["paid"],
        noticeRetry: { afterMs: 60_000, maxAttempts: 2 },
        ...over,
      },
      corrective: true,
      reason: "the platform notices",
    },
  });
  expect(res.statusCode, res.body).toBe(201);
}

async function noticeKeyOf(merchant: string): Promise<string> {
  const res = await admin(app.app, "POST", `/v1/admin/merchants/${merchant}/notice-keys`, { body: {} });
  expect(res.statusCode, res.body).toBe(201);
  return (json(res) as { value: string }).value;
}

const notify = (body: unknown, headers: Record<string, string> = {}) =>
  app.app.inject({
    method: "POST",
    url: "/v1/platform-notices",
    headers: { "content-type": "application/json", ...headers },
    payload: JSON.stringify(body),
  });

const withKey = (key: string) => ({ "x-ope-notice-key": key });

/** The scheduler's tick, a little later each time. */
async function tick(ms = 1_000): Promise<void> {
  now = new Date(now.getTime() + ms);
  await app.resolve(PlatformSchedulerPort).runDue(now);
}

const orderOf = (state: string) => ({
  orderId: "o1",
  state,
  total: PRICE,
  items: [{ sku: "s", quantity: 1 }],
});
const found = (orderId = "o1") => app.resolve(OrderLedgerPort).find(A, asOrderId(orderId));
interface OrdersSync {
  flows: { orders: { mode: string; pendingNotices?: number; lastOutcome?: unknown } };
}

const syncOfA = async () =>
  json(await admin(app.app, "GET", "/v1/admin/merchants/m_a/platform-sync")) as OrdersSync;
const pendingOfA = async () => (await syncOfA()).flows.orders.pendingNotices;

describe("notifyPlatformChange", () => {
  it("202 and, on the next tick, the order recorded with what was read", async () => {
    await subscribe("m_a");
    const key = await noticeKeyOf("m_a");
    source.script(A, { orders: [orderOf("paid")] });
    const res = await notify({ flow: "orders", reference: "o1", state: "paid" }, withKey(key));
    expect(res.statusCode, res.body).toBe(202);
    expect(json(res)).toEqual({ flow: "orders", reference: "o1", receivedAt: START.toISOString() });
    expect(await found()).toBeUndefined();
    expect(await syncOfA()).toMatchObject({ flows: { orders: { mode: "subscribe", pendingNotices: 1 } } });
    await tick();
    expect((await found())?.total.amount).toBe("123.00");
    expect(await syncOfA()).toMatchObject({ flows: { orders: { lastOutcome: { status: "ok", count: 1 } } } });
    expect(await pendingOfA()).toBeUndefined();
  });

  it("without a key, with the platform key or with an unknown one, 401 and nothing is queued", async () => {
    await subscribe("m_a");
    const body = { flow: "orders", reference: "o1" };
    const responses = [
      await notify(body),
      await notify(body, withKey("platform-a-1")),
      await notify(body, withKey("ope_nk_nobody")),
      // The platform key in its own header is not a notice key either.
      await notify(body, { "x-ope-platform-key": "platform-a-1" }),
    ];
    expect(responses.map((res) => res.statusCode)).toEqual([401, 401, 401, 401]);
    expect(await pendingOfA()).toBeUndefined();
  });

  it("a notice repeated while it is pending is one, and answers the first", async () => {
    await subscribe("m_a");
    const key = await noticeKeyOf("m_a");
    await notify({ flow: "orders", reference: "o1" }, withKey(key));
    now = new Date(START.getTime() + 5_000);
    const again = await notify({ flow: "orders", reference: "o1", state: "paid" }, withKey(key));
    expect(json(again)).toMatchObject({ receivedAt: START.toISOString() });
    expect(await syncOfA()).toMatchObject({ flows: { orders: { pendingNotices: 1 } } });
  });

  it("the state the notice says does not win over the one read: a notice of a paid order read as pending records nothing", async () => {
    await subscribe("m_a");
    const key = await noticeKeyOf("m_a");
    source.script(A, { orders: [orderOf("pending")] });
    await notify({ flow: "orders", reference: "o1", state: "paid" }, withKey(key));
    await tick();
    expect(await found()).toBeUndefined();
  });

  it("the return of a noticed return is read and linked to its order", async () => {
    await subscribe("m_a");
    const key = await noticeKeyOf("m_a");
    source.script(A, { orders: [orderOf("paid")], returns: [{ orderId: "o1" }] });
    await notify({ flow: "orders", reference: "o1" }, withKey(key));
    await tick();
    await notify({ flow: "returns", reference: "o1" }, withKey(key));
    await tick();
    expect((await found())?.status()).toBe("RETURNED");
  });

  it("an order without an instant, noticed and read twice, is one and counts both times (feature 045)", async () => {
    await subscribe("m_a");
    const key = await noticeKeyOf("m_a");
    source.script(A, { orders: [orderOf("paid")] });
    for (const wait of [1_000, 60_000]) {
      await notify({ flow: "orders", reference: "o1" }, withKey(key));
      await tick(wait);
      expect(await syncOfA(), String(wait)).toMatchObject({
        flows: { orders: { lastOutcome: { status: "ok", count: 1 } } },
      });
    }
    expect((await found())?.confirmedAt).toEqual(new Date(START.getTime() + 1_000));
  });

  it("a flow that is not in subscribe answers 409 sync-mode-not-configured", async () => {
    await subscribe("m_a", { syncStrategy: { orders: "subscribe", returns: "push" } });
    const key = await noticeKeyOf("m_a");
    const res = await notify({ flow: "returns", reference: "o1" }, withKey(key));
    expect(res.statusCode).toBe(409);
    expect(problemOf(res)).toMatchObject({
      type: "urn:ope:problem:sync-mode-not-configured",
      detail: "The flow returns of this merchant arrives by push.",
    });
  });

  it("a platform that does not answer is read again, and dropped with a trace when the attempts run out", async () => {
    await subscribe("m_a");
    const key = await noticeKeyOf("m_a");
    source.script(A, { failing: true });
    await notify({ flow: "orders", reference: "o1" }, withKey(key));
    await tick();
    expect(await syncOfA()).toMatchObject({ flows: { orders: { pendingNotices: 1 } } });
    await tick(60_000);
    expect(await syncOfA()).toMatchObject({
      flows: { orders: { lastOutcome: { status: "failed", reason: "notice-dropped" } } },
    });
    expect(await pendingOfA()).toBeUndefined();
  });

  it("a body that is not a notice is 400", async () => {
    await subscribe("m_a");
    const key = await noticeKeyOf("m_a");
    for (const body of [
      { flow: "catalog", reference: "o1" },
      { flow: "orders" },
      { flow: "orders", reference: "o1", total: 1 },
    ]) {
      expect((await notify(body, withKey(key))).statusCode, JSON.stringify(body)).toBe(400);
    }
  });
});
