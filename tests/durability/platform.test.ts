// Feature 044 (research R-09, R-10; SC-004): what the scheduler already brought survives a restart. The store of
// where each flow stands on a real file, and the whole durable server reading the test platform from the file
// `OPE_TEST_PLATFORM` names: the stock-and-price cycle resumes where it was, and a restart between depositing a
// batch of orders and moving the cursor repeats the batch without recording any order twice.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { durableDeployment } from "../../src/composition/deployments/durable.js";
import { replace } from "../../src/composition/graph/index.js";
import { CatalogStorePort } from "../../src/composition/modules/catalog.js";
import { OrderLedgerPort } from "../../src/composition/modules/outcomes.js";
import { PlatformSchedulerPort } from "../../src/composition/modules/platform.js";
import { ClockPort } from "../../src/composition/modules/shared-kernel.js";
import { SqlStorePort } from "../../src/composition/release.js";
import { asVariantId } from "../../src/domain/catalog/index.js";
import { asOrderId } from "../../src/domain/outcomes/index.js";
import { asMerchantId } from "../../src/domain/shared-kernel/index.js";
import {
  sqliteNoticeQueue,
  sqliteSyncStateStore,
  type TestPlatformScript,
} from "../../src/interface-adapters/platform/index.js";
import { json } from "../helpers/json.js";
import { admin, fixedClock, NOW, startTestApp } from "../helpers/test-app.js";
import { restartableStore, type Restartable } from "./store-fixture.js";
import type { App } from "../../src/composition/bootstrap.js";

const A = asMerchantId("m_a");
const B = asMerchantId("m_b");
const PRICE = { amount: "10.00", currency: "ARS" };
const at = (ms: number): Date => new Date(new Date(NOW).getTime() + ms);

describe("sqliteSyncStateStore", () => {
  let fixture: Restartable;
  beforeEach(() => {
    fixture = restartableStore();
  });
  afterEach(() => {
    fixture.dispose();
  });
  const store = () => sqliteSyncStateStore({ store: fixture.store, logger: fixture.logger });

  it("keeps the state of each flow across a restart, with its instants as dates, per merchant", async () => {
    const state = {
      cursor: "v7",
      lastRunAt: at(2),
      lastOkAt: at(1),
      lastOutcome: { status: "failed" as const, reason: "source-failed" },
    };
    expect((await store().save(A, "stockAndPrice", state)).ok).toBe(true);
    await store().save(A, "orders", { lastRunAt: at(3), lastOutcome: { status: "ok", count: 4 } });
    await store().save(B, "stockAndPrice", { cursor: "other" });
    fixture.restart();
    const states = await store().statesOf(A);
    expect(states).toEqual({
      stockAndPrice: state,
      orders: { lastRunAt: at(3), lastOutcome: { status: "ok", count: 4 } },
    });
    expect(states.stockAndPrice?.lastRunAt).toBeInstanceOf(Date);
    expect(await store().statesOf(B)).toEqual({ stockAndPrice: { cursor: "other" } });
    expect(await store().statesOf(asMerchantId("m_none"))).toEqual({});
  });

  it("a second save of a flow replaces the first, and leaves the other flows as they were", async () => {
    await store().save(A, "orders", { cursor: "1" });
    await store().save(A, "returns", { cursor: "9" });
    await store().save(A, "orders", { cursor: "2" });
    fixture.restart();
    expect(await store().statesOf(A)).toEqual({ orders: { cursor: "2" }, returns: { cursor: "9" } });
  });

  it("a store that cannot write says so, and logs why", async () => {
    fixture.makeUnavailable();
    const saved = await store().save(A, "orders", { cursor: "1" });
    expect(saved.ok ? undefined : saved.error.code).toBe("store-unavailable");
    expect(fixture.logged.map((entry) => entry.fields["write"])).toEqual(["platform sync"]);
  });
});

describe("sqliteNoticeQueue", () => {
  let fixture: Restartable;
  beforeEach(() => {
    fixture = restartableStore();
  });
  afterEach(() => {
    fixture.dispose();
  });
  const queue = () => sqliteNoticeQueue({ store: fixture.store, logger: fixture.logger });
  const notice = (reference: string, nextAt: Date, over: Record<string, unknown> = {}) => ({
    merchantId: A,
    flow: "orders" as const,
    reference,
    receivedAt: at(0),
    attempts: 0,
    nextAt,
    ...over,
  });

  it("keeps a pending notice across a restart, and a repeated one answers the first", async () => {
    const first = await queue().enqueue(notice("o1", at(0), { state: "paid" }));
    expect(first.ok ? first.value : undefined).toEqual(notice("o1", at(0), { state: "paid" }));
    fixture.restart();
    const again = await queue().enqueue(notice("o1", at(9), { receivedAt: at(9) }));
    expect(again.ok ? again.value : undefined).toEqual(notice("o1", at(0), { state: "paid" }));
    await queue().enqueue({ ...notice("o1", at(0)), flow: "returns" });
    await queue().enqueue({ ...notice("o1", at(0)), merchantId: B });
    expect(await queue().pendingOf(A)).toEqual({ orders: 1, returns: 1 });
    expect(await queue().pendingOf(asMerchantId("m_none"))).toEqual({});
  });

  it("answers what is due, oldest first; a reschedule moves it and a removal forgets it", async () => {
    await queue().enqueue(notice("late", at(20)));
    await queue().enqueue(notice("early", at(10)));
    await queue().enqueue(notice("later", at(30)));
    expect((await queue().due(at(20))).map((n) => n.reference)).toEqual(["early", "late"]);
    await queue().reschedule(notice("late", at(40), { attempts: 1 }));
    await queue().remove(notice("early", at(10)));
    fixture.restart();
    expect(await queue().due(at(30))).toEqual([notice("later", at(30))]);
    expect(await queue().due(at(40))).toEqual([
      notice("later", at(30)),
      notice("late", at(40), { attempts: 1 }),
    ]);
  });

  it("a store that cannot write says so, and logs why", async () => {
    fixture.makeUnavailable();
    const results = [
      await queue().enqueue(notice("o1", at(0))),
      await queue().reschedule(notice("o1", at(0))),
      await queue().remove(notice("o1", at(0))),
    ];
    expect(results.map((r) => (r.ok ? undefined : r.error.code))).toEqual([
      "store-unavailable",
      "store-unavailable",
      "store-unavailable",
    ]);
    expect(fixture.logged.map((entry) => entry.fields["write"])).toEqual([
      "platform notice",
      "platform notice",
      "platform notice",
    ]);
  });
});

describe("the durable server reading the test platform", () => {
  let dir: string;
  let platformFile: string;
  let app: App | undefined;

  const write = (script: TestPlatformScript): void => {
    writeFileSync(platformFile, JSON.stringify({ merchants: { m_a: script } }));
  };

  const boot = async (): Promise<App> => {
    app = await startTestApp(
      { deployment: durableDeployment, ports: [replace(ClockPort, fixedClock())] },
      { store: { file: path.join(dir, "ope.db") }, testPlatform: [platformFile] },
    );
    return app;
  };

  const restart = async (): Promise<App> => {
    await app?.close();
    return boot();
  };

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), "ope-platform-"));
    platformFile = path.join(dir, "platform.json");
  });
  afterEach(async () => {
    await app?.close();
    app = undefined;
    rmSync(dir, { recursive: true, force: true });
  });

  async function configure(running: App, declared: Record<string, unknown>): Promise<void> {
    const res = await admin(running.app, "POST", "/v1/admin/merchants/m_a/configuration", {
      body: {
        declared: {
          platformSource: "test",
          syncCadence: {
            catalogMs: 1,
            stockAndPriceMs: 1,
            stockAndPriceBatchSize: 1,
            ordersMs: 1,
            returnsMs: 1,
          },
          ...declared,
        },
        corrective: true,
        reason: "the platform is read by OPE",
      },
    });
    expect(res.statusCode, res.body).toBe(201);
  }

  it("the stock-and-price cycle resumes after a restart where it was, not at the start", async () => {
    write({
      catalog: {
        capturedAt: "2026-09-18T11:00:00.000Z",
        products: [
          {
            productId: "p1",
            title: "P",
            variants: [
              { variantId: "v1", available: true, price: PRICE },
              { variantId: "v2", available: true, price: PRICE },
            ],
          },
        ],
      },
      stockAndPrice: ["v1", "v2"].map((variantId) => ({
        variantId,
        available: false,
        price: PRICE,
        observedAt: "2026-09-18T11:30:00.000Z",
      })),
    });
    let running = await boot();
    await configure(running, { syncStrategy: { catalog: "pull", stockAndPrice: "pull" } });
    await running.resolve(PlatformSchedulerPort).runDue(at(1));
    const catalogue = () => running.resolve(CatalogStorePort);
    expect(await catalogue().refreshOf(A, asVariantId("v1"))).toBeDefined();
    expect(await catalogue().refreshOf(A, asVariantId("v2"))).toBeUndefined();
    running = await restart();
    await running.resolve(PlatformSchedulerPort).runDue(at(2));
    expect(await catalogue().refreshOf(A, asVariantId("v2"))).toBeDefined();
  });

  it("a restart between depositing a batch of orders and moving the cursor records none of them twice", async () => {
    const order = (orderId: string) => ({
      orderId,
      state: "paid",
      total: PRICE,
      items: [{ sku: "s", quantity: 1 }],
      confirmedAt: "2026-09-18T11:00:00.000Z",
    });
    write({ orders: [order("o1"), order("o2")] });
    let running = await boot();
    await configure(running, { syncStrategy: { orders: "pull" }, confirmedOrderStates: ["paid"] });
    await running.resolve(PlatformSchedulerPort).runDue(at(1));
    // What a crash after the deposit and before the cursor leaves: the orders written, the cursor not.
    running.resolve(SqlStorePort).run("DELETE FROM platform_sync");
    running = await restart();
    await running.resolve(PlatformSchedulerPort).runDue(at(2));
    const orders = running.resolve(OrderLedgerPort);
    for (const id of ["o1", "o2"]) expect(await orders.find(A, asOrderId(id)), id).toBeDefined();
    const count = running
      .resolve(SqlStorePort)
      .all("SELECT COUNT(*) AS n FROM orders WHERE merchant_id = 'm_a'");
    expect(Number(count[0]?.["n"])).toBe(2);
    const sync = json(await admin(running.app, "GET", "/v1/admin/merchants/m_a/platform-sync"));
    expect(sync).toMatchObject({ flows: { orders: { lastOutcome: { status: "ok", count: 2 } } } });
  });

  it("a pending notice survives a restart and is read after it", async () => {
    write({
      orders: [
        { orderId: "o1", state: "paid", total: PRICE, items: [], confirmedAt: "2026-09-18T11:00:00.000Z" },
      ],
    });
    let running = await boot();
    await configure(running, { syncStrategy: { orders: "subscribe" }, confirmedOrderStates: ["paid"] });
    const rotated = await admin(running.app, "POST", "/v1/admin/merchants/m_a/notice-keys", { body: {} });
    const key = (json(rotated) as { value: string }).value;
    const noticed = await running.app.inject({
      method: "POST",
      url: "/v1/platform-notices",
      headers: { "content-type": "application/json", "x-ope-notice-key": key },
      payload: JSON.stringify({ flow: "orders", reference: "o1" }),
    });
    expect(noticed.statusCode).toBe(202);
    running = await restart();
    expect(await running.resolve(OrderLedgerPort).find(A, asOrderId("o1"))).toBeUndefined();
    await running.resolve(PlatformSchedulerPort).runDue(at(1));
    expect(await running.resolve(OrderLedgerPort).find(A, asOrderId("o1"))).toBeDefined();
  });

  it("a return left waiting for its order survives a restart and enters when the order arrives (feature 045)", async () => {
    const order = {
      orderId: "o1",
      state: "paid",
      total: PRICE,
      items: [],
      confirmedAt: "2026-09-18T11:00:00.000Z",
    };
    write({ returns: [{ orderId: "o1", returnedAt: "2026-09-18T11:30:00.000Z" }] });
    let running = await boot();
    await configure(running, {
      syncStrategy: { orders: "pull", returns: "pull" },
      confirmedOrderStates: ["paid"],
      noticeRetry: { afterMs: 1, maxAttempts: 5 },
    });
    await running.resolve(PlatformSchedulerPort).runDue(at(1));
    running = await restart();
    write({ orders: [order], returns: [{ orderId: "o1", returnedAt: "2026-09-18T11:30:00.000Z" }] });
    await running.resolve(PlatformSchedulerPort).runDue(at(2));
    expect((await running.resolve(OrderLedgerPort).find(A, asOrderId("o1")))?.status()).toBe("RETURNED");
  });

  it("after a restart, a run that had failed is tried again at the retry, not at its cadence (feature 045)", async () => {
    write({ failing: true });
    let running = await boot();
    await configure(running, {
      syncStrategy: { catalog: "pull" },
      syncCadence: {
        catalogMs: 86_400_000,
        stockAndPriceMs: 1,
        stockAndPriceBatchSize: 1,
        ordersMs: 1,
        returnsMs: 1,
      },
      noticeRetry: { afterMs: 1_000, maxAttempts: 3 },
    });
    await running.resolve(PlatformSchedulerPort).runDue(at(1));
    running = await restart();
    await running.resolve(PlatformSchedulerPort).runDue(at(1_001));
    const sync = json(await admin(running.app, "GET", "/v1/admin/merchants/m_a/platform-sync")) as {
      flows: { catalog: { lastRunAt?: string } };
    };
    expect(sync.flows.catalog.lastRunAt).toBe(at(1_001).toISOString());
  });

  it("without the variable the durable server does not have the test platform, and refuses a merchant that names it", async () => {
    app = await startTestApp(
      { deployment: durableDeployment, ports: [replace(ClockPort, fixedClock())] },
      { store: { file: path.join(dir, "ope.db") } },
    );
    const res = await admin(app.app, "POST", "/v1/admin/merchants/m_a/configuration", {
      body: { declared: { platformSource: "test" }, corrective: true, reason: "the platform is read by OPE" },
    });
    expect(res.statusCode).toBe(422);
  });
});
