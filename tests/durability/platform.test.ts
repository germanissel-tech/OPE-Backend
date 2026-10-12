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
