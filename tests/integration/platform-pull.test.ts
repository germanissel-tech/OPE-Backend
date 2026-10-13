// Feature 044 — US1, US2 (FR-002, FR-005, FR-006, FR-016; research R-03, R-07, R-10): a merchant in `pull` has
// its catalogue, its stock and price, its confirmed orders and its returns without its platform sending
// anything. The whole server, with the test platform scripted and the scheduler run with the test's clock.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { replace } from "../../src/composition/graph/index.js";
import { CatalogStorePort } from "../../src/composition/modules/catalog.js";
import { OrderLedgerPort } from "../../src/composition/modules/outcomes.js";
import { InstalledSourcesPort, PlatformSchedulerPort } from "../../src/composition/modules/platform.js";
import { ClockPort } from "../../src/composition/modules/shared-kernel.js";
import { asVariantId } from "../../src/domain/catalog/index.js";
import { asOrderId } from "../../src/domain/outcomes/index.js";
import { asMerchantId } from "../../src/domain/shared-kernel/index.js";
import {
  installedSources,
  scriptedTestSource,
  type ScriptedOrder,
  type ScriptedTestSource,
} from "../../src/interface-adapters/platform/index.js";
import { json, problemOf } from "../helpers/json.js";
import { admin, catalogProductOf, sharedTestApp, type SharedApp } from "../helpers/test-app.js";

const START = new Date("2026-09-18T12:00:00.000Z");
const A = asMerchantId("m_a");
const B = asMerchantId("m_b");
const PRICE = { amount: "100.00", currency: "ARS" };

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

/** The scheduler, run as the timer would, a little later each time so every cadence below is due. */
async function tick(ms = 1_000): Promise<void> {
  now = new Date(now.getTime() + ms);
  await app.resolve(PlatformSchedulerPort).runDue(now);
}

async function configure(merchant: string, declared: Record<string, unknown>) {
  return admin(app.app, "POST", `/v1/admin/merchants/${merchant}/configuration`, {
    // Corrective, because the merchant of the tests runs an experiment and its configuration is frozen.
    body: { declared, corrective: true, reason: "the platform is read by OPE" },
  });
}

const PULLED = {
  platformSource: "test",
  syncCadence: { catalogMs: 1, stockAndPriceMs: 1, stockAndPriceBatchSize: 200, ordersMs: 1, returnsMs: 1 },
};

async function pullOrders(merchant: string, states: string[]): Promise<void> {
  const res = await configure(merchant, {
    ...PULLED,
    syncStrategy: { orders: "pull", returns: "pull" },
    confirmedOrderStates: states,
  });
  expect(res.statusCode).toBe(201);
}

const orderOf = (orderId: string, state: string): ScriptedOrder => ({
  orderId,
  state,
  total: PRICE,
  items: [{ sku: "SKU-1", quantity: 1 }],
});

const found = (merchant = A, orderId = "o1") =>
  app.resolve(OrderLedgerPort).find(merchant, asOrderId(orderId));

describe("orders and returns by pull", () => {
  it("only the confirmed states enter; one that reaches a confirmed state later enters in that run", async () => {
    await pullOrders("m_a", ["paid"]);
    source.script(A, { orders: [orderOf("o1", "pending"), orderOf("o2", "paid")] });
    await tick();
    expect(await found(A, "o1")).toBeUndefined();
    expect(await found(A, "o2")).toBeDefined();
    source.script(A, { orders: [orderOf("o1", "pending"), orderOf("o2", "paid"), orderOf("o1", "paid")] });
    await tick();
    expect((await found(A, "o1"))?.status()).toBe("VERIFIED_ORDER");
  });

  it("an order seen twice is recorded once", async () => {
    await pullOrders("m_a", ["paid"]);
    source.script(A, { orders: [orderOf("o1", "paid"), orderOf("o1", "paid")] });
    await tick();
    const res = await admin(app.app, "GET", "/v1/admin/merchants/m_a/platform-sync");
    expect(json(res)).toMatchObject({ flows: { orders: { lastOutcome: { status: "ok", count: 2 } } } });
    expect(await found()).toBeDefined();
  });

  it("an order without an instant, read again in a later run, is a repeat and counts (feature 045)", async () => {
    await pullOrders("m_a", ["paid"]);
    source.script(A, { orders: [orderOf("o1", "paid")] });
    await tick();
    // The platform lists the same order again: the read a minute later puts another instant.
    source.script(A, { orders: [orderOf("o1", "paid"), orderOf("o1", "paid")] });
    await tick(60_000);
    const res = await admin(app.app, "GET", "/v1/admin/merchants/m_a/platform-sync");
    expect(json(res)).toMatchObject({ flows: { orders: { lastOutcome: { status: "ok", count: 1 } } } });
    source.script(A, {
      orders: [
        orderOf("o1", "paid"),
        orderOf("o1", "paid"),
        { ...orderOf("o1", "paid"), total: { amount: "1.00", currency: "ARS" } },
      ],
    });
    await tick(60_000);
    const conflict = await admin(app.app, "GET", "/v1/admin/merchants/m_a/platform-sync");
    expect(json(conflict)).toMatchObject({ flows: { orders: { lastOutcome: { status: "ok", count: 0 } } } });
    expect((await found())?.total.amount).toBe("100.00");
  });

  it("the return of a pulled order is linked to it", async () => {
    await pullOrders("m_a", ["paid"]);
    source.script(A, { orders: [orderOf("o1", "paid")] });
    await tick();
    source.script(A, { orders: [orderOf("o1", "paid")], returns: [{ orderId: "o1" }] });
    await tick();
    expect((await found())?.status()).toBe("RETURNED");
  });

  it("a return read before its order waits, and enters when the order arrives (feature 045)", async () => {
    await pullOrders("m_a", ["paid"]);
    source.script(A, { returns: [{ orderId: "o1" }] });
    await tick();
    const waiting = json(await admin(app.app, "GET", "/v1/admin/merchants/m_a/platform-sync"));
    expect(waiting).toMatchObject({
      flows: { returns: { pendingNotices: 1, lastOutcome: { status: "ok", count: 0 } } },
    });
    source.script(A, { orders: [orderOf("o1", "paid")], returns: [{ orderId: "o1" }] });
    await tick();
    expect((await found())?.status()).toBe("VERIFIED_ORDER");
    await tick(60_000);
    expect((await found())?.status()).toBe("RETURNED");
    const read = json(await admin(app.app, "GET", "/v1/admin/merchants/m_a/platform-sync")) as {
      flows: { returns: { pendingNotices?: number } };
    };
    expect(read.flows.returns.pendingNotices).toBeUndefined();
  });

  it("a return left waiting is dropped when its flow stops arriving by pull (feature 045)", async () => {
    await pullOrders("m_a", ["paid"]);
    source.script(A, { orders: [orderOf("o1", "paid")] });
    source.script(A, { returns: [{ orderId: "o1" }] });
    await tick();
    const res = await configure("m_a", {
      ...PULLED,
      syncStrategy: { orders: "pull", returns: "push" },
      confirmedOrderStates: ["paid"],
    });
    expect(res.statusCode).toBe(201);
    source.script(A, { orders: [orderOf("o1", "paid")], returns: [{ orderId: "o1" }] });
    await tick(60_000);
    expect((await found())?.status()).toBe("VERIFIED_ORDER");
    const read = json(await admin(app.app, "GET", "/v1/admin/merchants/m_a/platform-sync")) as {
      flows: { returns: { pendingNotices?: number } };
    };
    expect(read.flows.returns.pendingNotices).toBeUndefined();
  });

  it("changing the confirmed states by a version changes the next run", async () => {
    await pullOrders("m_a", ["paid"]);
    source.script(A, { orders: [orderOf("o1", "invoiced")] });
    await tick();
    expect(await found()).toBeUndefined();
    await pullOrders("m_a", ["paid", "invoiced"]);
    source.script(A, { orders: [orderOf("o1", "invoiced"), orderOf("o2", "invoiced")] });
    await tick();
    // What was read before the version is behind the cursor; what comes after it enters by the new rule.
    expect(await found(A, "o1")).toBeUndefined();
    expect(await found(A, "o2")).toBeDefined();
  });

  it("the run of A never deposits in B, and B in push is never read", async () => {
    await pullOrders("m_a", ["paid"]);
    source.script(A, { orders: [orderOf("o1", "paid")] });
    source.script(B, { orders: [orderOf("o9", "paid")] });
    await tick();
    expect(await found(A, "o1")).toBeDefined();
    expect(await found(B, "o1")).toBeUndefined();
    expect(await found(B, "o9")).toBeUndefined();
    const b = json(await admin(app.app, "GET", "/v1/admin/merchants/m_b/platform-sync"));
    expect(b).toEqual({
      platform: "generic",
      flows: {
        catalog: { mode: "push" },
        stockAndPrice: { mode: "push" },
        orders: { mode: "push" },
        returns: { mode: "push" },
      },
    });
  });
});

describe("the catalogue and stock and price by pull", () => {
  it("the catalogue and then its stock and price arrive without the platform sending them", async () => {
    const res = await configure("m_a", {
      ...PULLED,
      syncStrategy: { catalog: "pull", stockAndPrice: "pull" },
    });
    expect(res.statusCode).toBe(201);
    const product = catalogProductOf("P1", 2) as { variants: { variantId: string }[] };
    source.script(A, {
      catalog: { capturedAt: "2026-09-18T11:00:00.000Z", products: [product as never] },
      stockAndPrice: [{ variantId: "P1-M", available: false, price: PRICE }],
    });
    await tick();
    expect((await app.resolve(CatalogStorePort).current(A))?.products).toHaveLength(1);
    await tick();
    const refreshed = await app.resolve(CatalogStorePort).refreshOf(A, asVariantId("P1-M"));
    expect(refreshed).toMatchObject({ available: false, observedAt: now });
    expect(await app.resolve(CatalogStorePort).current(B)).toBeUndefined();
  });
});

describe("the retry of a run that failed (feature 045)", () => {
  it("a catalogue that fails is read again at the retry, not a day later, and back at its cadence once it works", async () => {
    const res = await configure("m_a", {
      platformSource: "test",
      syncStrategy: { catalog: "pull" },
      syncCadence: { catalogMs: 86_400_000 },
      noticeRetry: { afterMs: 60_000, maxAttempts: 3 },
    });
    expect(res.statusCode).toBe(201);
    const lastRun = async () =>
      (
        json(await admin(app.app, "GET", "/v1/admin/merchants/m_a/platform-sync")) as {
          flows: { catalog: { lastRunAt?: string; lastOutcome?: { status: string } } };
        }
      ).flows.catalog;
    source.script(A, { failing: true });
    await tick();
    const failedAt = (await lastRun()).lastRunAt;
    await tick(30_000);
    expect((await lastRun()).lastRunAt).toBe(failedAt);
    await tick(30_000);
    expect((await lastRun()).lastRunAt).toBe(now.toISOString());
    source.script(A, { catalog: { products: [catalogProductOf("P1") as never] } });
    await tick(60_000);
    expect(await lastRun()).toMatchObject({ lastRunAt: now.toISOString(), lastOutcome: { status: "ok" } });
    const workedAt = now.toISOString();
    await tick(3_600_000);
    expect((await lastRun()).lastRunAt).toBe(workedAt);
  });
});

describe("getMerchantPlatformSync", () => {
  it("answers each flow with its mode and its last run; what never ran is absent", async () => {
    await pullOrders("m_a", ["paid"]);
    source.script(A, { orders: [orderOf("o1", "paid")], failing: true });
    await tick();
    const failedAt = now.toISOString();
    source.script(A, { orders: [orderOf("o1", "paid")] });
    await tick();
    const res = await admin(app.app, "GET", "/v1/admin/merchants/m_a/platform-sync");
    expect(res.statusCode).toBe(200);
    expect(json(res)).toEqual({
      platform: "test",
      flows: {
        catalog: { mode: "push" },
        stockAndPrice: { mode: "push" },
        orders: {
          mode: "pull",
          lastRunAt: now.toISOString(),
          lastOkAt: now.toISOString(),
          lastOutcome: { status: "ok", count: 1 },
        },
        returns: {
          mode: "pull",
          lastRunAt: now.toISOString(),
          lastOkAt: now.toISOString(),
          lastOutcome: { status: "ok", count: 0 },
        },
      },
    });
    expect(failedAt).not.toBe(now.toISOString());
  });

  it("a failed run says why and keeps the last one that was ok", async () => {
    await pullOrders("m_a", ["paid"]);
    await tick();
    const okAt = now.toISOString();
    source.script(A, { failing: true });
    await tick();
    const res = json(await admin(app.app, "GET", "/v1/admin/merchants/m_a/platform-sync"));
    expect(res).toMatchObject({
      flows: {
        orders: {
          lastRunAt: now.toISOString(),
          lastOkAt: okAt,
          lastOutcome: { status: "failed", reason: "source-failed" },
        },
      },
    });
  });

  it("outside the operator's scope it is 403, without saying whether the merchant exists", async () => {
    const onB = await admin(app.app, "GET", "/v1/admin/merchants/m_b/platform-sync", { as: "ops-a" });
    const onNobody = await admin(app.app, "GET", "/v1/admin/merchants/m_zz/platform-sync", { as: "ops-a" });
    expect([onB.statusCode, onNobody.statusCode]).toEqual([403, 403]);
    // The same answer but for where it was asked and the request it answers.
    const anonymous = (res: typeof onB) => ({ ...problemOf(res), instance: undefined, requestId: undefined });
    expect(anonymous(onB)).toEqual(anonymous(onNobody));
    expect(problemOf(onB).type).toBe("urn:ope:problem:merchant-out-of-scope");
  });

  it("a merchant that does not exist is 404 for an operator that may see every merchant", async () => {
    const res = await admin(app.app, "GET", "/v1/admin/merchants/m_zz/platform-sync");
    expect(res.statusCode).toBe(404);
  });
});

describe("publishing a mode nothing executes", () => {
  it("pull with the generic adapter is refused at the flow", async () => {
    const res = await configure("m_a", { syncStrategy: { catalog: "pull" } });
    expect(res.statusCode).toBe(422);
    expect(problemOf(res).errors?.[0]?.pointer).toBe("/body/declared/syncStrategy/catalog");
  });

  it("subscribe on the catalogue is refused even with the test platform", async () => {
    const res = await configure("m_a", { platformSource: "test", syncStrategy: { catalog: "subscribe" } });
    expect(res.statusCode).toBe(422);
    expect(problemOf(res).errors?.[0]?.pointer).toBe("/body/declared/syncStrategy/catalog");
  });

  it("a source this deployment did not install is refused", async () => {
    await app.resetPorts({ ports: [replace(InstalledSourcesPort, installedSources(new Map()))] });
    const res = await configure("m_a", { platformSource: "test" });
    expect(res.statusCode).toBe(422);
    expect(problemOf(res).errors?.[0]?.pointer).toBe("/body/declared/platformSource");
  });

  it("orders pulled without a confirmed state are refused", async () => {
    const res = await configure("m_a", { platformSource: "test", syncStrategy: { orders: "pull" } });
    expect(res.statusCode).toBe(422);
    expect(problemOf(res).errors?.[0]?.pointer).toBe("/body/declared/confirmedOrderStates");
  });
});
