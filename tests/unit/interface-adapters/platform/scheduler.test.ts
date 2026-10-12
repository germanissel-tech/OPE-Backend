// Feature 044 — US1, US2 (ADR-047; research R-03, R-07): the scheduler of `pull` reads what is due, deposits
// through the use cases and only then moves the cursor. With a scripted source, use cases that record what they
// are asked, and the clock in the test's hand.
import { describe, expect, it } from "vitest";
import { asProductId, asVariantId, CatalogSnapshot } from "../../../../src/domain/catalog/index.js";
import { LedgerUnavailable } from "../../../../src/domain/ledger/index.js";
import {
  NoticeRetry,
  OrderConfirmation,
  SyncCadence,
  type SyncState,
} from "../../../../src/domain/platform/index.js";
import {
  DomainError,
  fail,
  ok,
  type MerchantId,
  type Result,
  type SyncStrategy,
} from "../../../../src/domain/shared-kernel/index.js";
import { memoryMerchantStore } from "../../../../src/interface-adapters/merchant/gateways/memory-merchant-store.js";
import {
  installedSources,
  memorySyncStateStore,
  platformScheduler,
  scriptedTestSource,
  type PlatformSource,
  type TestPlatformScript,
} from "../../../../src/interface-adapters/platform/index.js";
import { TEST_NOW, testMerchant } from "../../../helpers/merchants.js";
import type { PlatformPolicy } from "../../../../src/application/platform/index.js";
import type { UseCase } from "../../../../src/application/shared-kernel/index.js";

const A = "m_a" as MerchantId;
const B = "m_b" as MerchantId;
const PUSH: SyncStrategy = { catalog: "push", stockAndPrice: "push", orders: "push", returns: "push" };
const CADENCE = {
  catalogMs: 1_000,
  stockAndPriceMs: 1_000,
  stockAndPriceBatchSize: 2,
  ordersMs: 1_000,
  returnsMs: 1_000,
};
const at = (ms: number): Date => new Date(TEST_NOW.getTime() + ms);
const PRICE = { amount: "10.00", currency: "ARS" };

class Refused extends DomainError {
  readonly code = "refused-for-the-test" as const;
  readonly module = "test" as const;
  constructor() {
    super("Refused by the test.");
  }
}

/** A use case that records what it is asked and answers what the test says. */
function recording<I>(answer: (request: I) => Result<unknown, DomainError> = () => ok(undefined)) {
  const calls: I[] = [];
  const useCase: UseCase<I, Result<unknown, DomainError>> = {
    execute: (request) => {
      calls.push(request);
      return Promise.resolve(answer(request));
    },
  };
  return { calls, useCase };
}

const productWith = (...variantIds: string[]) => ({
  productId: asProductId("p1"),
  title: "Product",
  attributes: [],
  variants: variantIds.map((id) => ({
    variantId: asVariantId(id),
    attributes: [],
    available: true,
    price: PRICE,
  })),
});

interface Setup {
  strategy?: Partial<SyncStrategy>;
  cadence?: Partial<typeof CADENCE>;
  states?: string[];
  source?: PlatformSource;
  variants?: string[];
  answers?: {
    order?: (request: { orderId: string }) => Result<unknown, DomainError>;
    catalog?: () => Result<unknown, DomainError>;
  };
}

async function subject(setup: Setup = {}) {
  const merchants = memoryMerchantStore();
  await merchants.create(testMerchant({ merchantId: A }));
  const source = scriptedTestSource();
  const policy: PlatformPolicy = {
    source: "test",
    strategy: { ...PUSH, ...setup.strategy },
    cadence: SyncCadence.rehydrate({ ...CADENCE, ...setup.cadence }),
    confirmation: OrderConfirmation.rehydrate(setup.states ?? ["paid"]),
    retry: NoticeRetry.rehydrate({ afterMs: 1_000, maxAttempts: 3 }),
  };
  const states = memorySyncStateStore();
  const upsert = recording<{ merchantId: MerchantId; capturedAt: Date; products: readonly unknown[] }>(
    setup.answers?.catalog,
  );
  const refresh = recording<{
    merchantId: MerchantId;
    items: readonly { variantId: string; observedAt: Date }[];
  }>();
  const order = recording<{ merchantId: MerchantId; orderId: string; confirmedAt: Date }>(
    setup.answers?.order,
  );
  const returned = recording<{ merchantId: MerchantId; orderId: string; returnedAt: Date }>();
  const logged: string[] = [];
  /** When the notices were read: after the pull runs of the same tick. */
  const noticesRead: Date[] = [];
  /** What each line logged said besides its message: the merchant and the flow are what make it findable. */
  const said: unknown[] = [];
  const snapshot = CatalogSnapshot.rehydrate({
    merchantId: A,
    capturedAt: TEST_NOW,
    receivedAt: TEST_NOW,
    products: [productWith(...(setup.variants ?? []))],
  });
  const scheduler = platformScheduler({
    merchants,
    policies: { policyFor: () => Promise.resolve(policy) },
    states,
    sources: installedSources(new Map([["test", setup.source ?? source]])),
    catalog: { current: (merchantId) => Promise.resolve(merchantId === A ? snapshot : undefined) },
    upsertCatalog: upsert.useCase,
    refreshStockAndPrice: refresh.useCase,
    notifyOrder: order.useCase,
    notifyReturn: returned.useCase,
    notices: {
      readDue: (now) => {
        noticesRead.push(now);
        return Promise.resolve();
      },
    },
    logger: {
      info: () => undefined,
      warn: (fields, message) => {
        said.push(fields);
        logged.push(message);
      },
      error: (fields, message) => {
        said.push(fields);
        logged.push(message);
      },
    },
  });
  const stateOf = async (
    flow: "catalog" | "stockAndPrice" | "orders" | "returns",
  ): Promise<SyncState | undefined> => (await states.statesOf(A))[flow];
  const script = (s: TestPlatformScript) => {
    source.script(A, s);
  };
  return {
    scheduler,
    merchants,
    policy,
    upsert,
    refresh,
    order,
    returned,
    logged,
    said,
    noticesRead,
    stateOf,
    script,
    states,
  };
}

const CATALOG = { products: [{ productId: "p1", title: "P", variants: [] }] };

describe("platformScheduler", () => {
  it("runs a flow in pull when its cadence is due, counted from the start of the last run, and never one in push", async () => {
    const { scheduler, upsert, refresh, script, stateOf } = await subject({ strategy: { catalog: "pull" } });
    script({ catalog: CATALOG });
    await scheduler.runDue(at(0));
    await scheduler.runDue(at(999));
    expect(upsert.calls).toHaveLength(1);
    await scheduler.runDue(at(1_000));
    expect(upsert.calls).toHaveLength(2);
    expect(refresh.calls).toHaveLength(0);
    expect(await stateOf("catalog")).toEqual({
      cursor: undefined,
      lastRunAt: at(1_000),
      lastOkAt: at(1_000),
      lastOutcome: { status: "ok", count: 1 },
    });
    expect(await stateOf("stockAndPrice")).toBeUndefined();
  });

  it("reads the notices that are due on the same tick, after the pull runs, with the same instant", async () => {
    const { scheduler, upsert, noticesRead, script } = await subject({ strategy: { catalog: "pull" } });
    script({ catalog: CATALOG });
    await scheduler.runDue(at(5));
    expect(upsert.calls).toHaveLength(1);
    expect(noticesRead).toEqual([at(5)]);
  });

  it("skips a merchant whose switch is off and one that is deactivated, and reads the others", async () => {
    const { scheduler, merchants, upsert, script } = await subject({ strategy: { catalog: "pull" } });
    script({ catalog: CATALOG });
    const a = await merchants.get(A);
    if (a === undefined) throw new Error("no merchant");
    const off = a.switched(false);
    if (!off.ok) throw new Error("not switched");
    await merchants.update(off.value);
    await merchants.create(testMerchant({ merchantId: B }).deactivated());
    await scheduler.runDue(at(0));
    expect(upsert.calls).toHaveLength(0);
    const on = off.value.switched(true);
    if (!on.ok) throw new Error("not switched");
    await merchants.update(on.value);
    await scheduler.runDue(at(0));
    expect(upsert.calls.map((call) => call.merchantId)).toEqual([A]);
  });

  it("walks the catalogue in batches in lexicographic order and starts again past the last variant (SC-002)", async () => {
    const asked: string[][] = [];
    const scripted = scriptedTestSource();
    const source: PlatformSource = {
      ...scripted,
      stockAndPrice: (merchantId, variantIds) => {
        asked.push([...variantIds]);
        return scripted.stockAndPrice(merchantId, variantIds);
      },
    };
    const { scheduler, stateOf } = await subject({
      strategy: { stockAndPrice: "pull" },
      variants: ["v3", "v1", "v4", "v2", "v5"],
      source,
    });
    for (const ms of [0, 1_000, 2_000, 3_000]) await scheduler.runDue(at(ms));
    expect(asked).toEqual([["v1", "v2"], ["v3", "v4"], ["v5"], ["v1", "v2"]]);
    expect((await stateOf("stockAndPrice"))?.cursor).toBe("v2");
  });

  it("deposits what the source has of the batch, and an item without an instant takes the observation's", async () => {
    const { scheduler, refresh, script, stateOf } = await subject({
      strategy: { stockAndPrice: "pull" },
      variants: ["v1", "v2"],
    });
    script({
      stockAndPrice: [
        { variantId: "v1", available: true, price: PRICE },
        { variantId: "v2", available: false, price: PRICE, observedAt: "2026-09-19T11:00:00.000Z" },
        { variantId: "v9", available: true, price: PRICE },
      ],
    });
    await scheduler.runDue(at(5));
    expect(refresh.calls).toHaveLength(1);
    expect(refresh.calls[0]?.items.map((item) => [item.variantId, item.observedAt])).toEqual([
      ["v1", at(5)],
      ["v2", new Date("2026-09-19T11:00:00.000Z")],
    ]);
    expect((await stateOf("stockAndPrice"))?.lastOutcome).toEqual({ status: "ok", count: 2 });
  });

  it("a batch the source has nothing of deposits nothing and still moves on", async () => {
    const { scheduler, refresh, stateOf } = await subject({
      strategy: { stockAndPrice: "pull" },
      variants: ["v1"],
    });
    await scheduler.runDue(at(0));
    expect(refresh.calls).toHaveLength(0);
    expect(await stateOf("stockAndPrice")).toMatchObject({
      cursor: "v1",
      lastOutcome: { status: "ok", count: 0 },
    });
  });

  it("with no catalogue there is no batch: the source is not asked, and the run is ok with nothing", async () => {
    let asked = 0;
    const scripted = scriptedTestSource();
    const source: PlatformSource = {
      ...scripted,
      stockAndPrice: (merchantId, variantIds) => {
        asked += 1;
        return scripted.stockAndPrice(merchantId, variantIds);
      },
    };
    const { scheduler, refresh, stateOf, states } = await subject({
      strategy: { stockAndPrice: "pull" },
      source,
    });
    // A cursor from a catalogue that is gone stays where it was: there is nothing to move it to.
    await states.save(A, "stockAndPrice", { cursor: "v9" });
    await scheduler.runDue(at(0));
    expect(asked).toBe(0);
    expect(refresh.calls).toHaveLength(0);
    expect(await stateOf("stockAndPrice")).toMatchObject({
      cursor: "v9",
      lastOutcome: { status: "ok", count: 0 },
    });
  });

  it("a catalogue without an instant takes the observation's, and one with it keeps it", async () => {
    const { scheduler, upsert, script } = await subject({ strategy: { catalog: "pull" } });
    script({ catalog: CATALOG });
    await scheduler.runDue(at(7));
    script({ catalog: { ...CATALOG, capturedAt: "2026-09-19T10:00:00.000Z" } });
    await scheduler.runDue(at(2_000));
    expect(upsert.calls.map((call) => call.capturedAt)).toEqual([
      at(7),
      new Date("2026-09-19T10:00:00.000Z"),
    ]);
  });

  it("a source that does not answer leaves the run failed with its reason, the cursor where it was and the last ok", async () => {
    const { scheduler, script, stateOf, logged, said } = await subject({ strategy: { orders: "pull" } });
    script({ orders: [{ orderId: "o1", state: "paid", total: PRICE, items: [] }] });
    await scheduler.runDue(at(0));
    script({ failing: true });
    await scheduler.runDue(at(1_000));
    expect(await stateOf("orders")).toEqual({
      cursor: "1",
      lastRunAt: at(1_000),
      lastOkAt: at(0),
      lastOutcome: { status: "failed", reason: "source-failed" },
    });
    expect(logged).toContain("The platform did not answer a read; nothing was deposited.");
    expect(logged).toContain("A run of the platform reading failed.");
    expect(said).toEqual([
      { merchantId: A, flow: "orders", cause: "The test platform does not answer." },
      { merchantId: A, flow: "orders", reason: "source-failed" },
    ]);
  });

  it("a catalogue the core refuses fails the run with the type of the problem", async () => {
    const { scheduler, script, stateOf } = await subject({
      strategy: { catalog: "pull" },
      answers: { catalog: () => fail(new Refused()) },
    });
    script({ catalog: CATALOG });
    await scheduler.runDue(at(0));
    expect((await stateOf("catalog"))?.lastOutcome).toEqual({
      status: "failed",
      reason: "refused-for-the-test",
    });
    expect((await stateOf("catalog"))?.lastOkAt).toBeUndefined();
  });

  it("a merchant whose source this deployment does not have is reported, not read", async () => {
    const { scheduler, policy, stateOf } = await subject({ strategy: { catalog: "pull" } });
    policy.source = "generic";
    await scheduler.runDue(at(0));
    expect((await stateOf("catalog"))?.lastOutcome).toEqual({
      status: "failed",
      reason: "source-not-installed",
    });
  });

  it("walks every page of the directory: a merchant past the first page is read too", async () => {
    const source = scriptedTestSource();
    const { scheduler, merchants, upsert } = await subject({ strategy: { catalog: "pull" }, source });
    // The directory lists in the order merchants were created, so the last of a hundred more is past a page.
    for (let i = 0; i < 100; i += 1) {
      await merchants.create(testMerchant({ merchantId: `m_${String(i).padStart(3, "0")}` }));
    }
    const last = "m_099" as MerchantId;
    source.script(last, { catalog: CATALOG });
    await scheduler.runDue(at(0));
    expect(upsert.calls.map((call) => call.merchantId)).toEqual([last]);
  });

  it("never runs the same merchant and flow twice at once", async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    let reads = 0;
    const scripted = scriptedTestSource();
    const source: PlatformSource = {
      ...scripted,
      catalog: async () => {
        reads += 1;
        await held;
        return { products: [] };
      },
    };
    const { scheduler } = await subject({ strategy: { catalog: "pull" }, source });
    const first = scheduler.runDue(at(0));
    await new Promise((resolve) => setImmediate(resolve));
    await scheduler.runDue(at(5_000));
    expect(reads).toBe(1);
    release();
    await first;
    await scheduler.runDue(at(10_000));
    expect(reads).toBe(2);
  });

  describe("orders and returns", () => {
    const order = (orderId: string, state: string, confirmedAt?: string) => ({
      orderId,
      state,
      total: PRICE,
      items: [{ sku: "s1", quantity: 1 }],
      ...(confirmedAt === undefined ? {} : { confirmedAt }),
    });

    it("only the states the merchant confirms enter, with the platform's instant or the observation's", async () => {
      const {
        scheduler,
        order: notified,
        script,
        stateOf,
      } = await subject({
        strategy: { orders: "pull" },
        states: ["paid", "invoiced"],
      });
      script({
        orders: [
          order("o1", "pending"),
          order("o2", "paid", "2026-09-19T11:30:00.000Z"),
          order("o3", "invoiced"),
          order("o1", "paid"),
        ],
      });
      await scheduler.runDue(at(3));
      expect(notified.calls.map((call) => [call.orderId, call.confirmedAt])).toEqual([
        ["o2", new Date("2026-09-19T11:30:00.000Z")],
        ["o3", at(3)],
        ["o1", at(3)],
      ]);
      expect(await stateOf("orders")).toMatchObject({ cursor: "4", lastOutcome: { status: "ok", count: 3 } });
    });

    it("the next run reads from the cursor: what was read is not read again", async () => {
      const { scheduler, order: notified, script } = await subject({ strategy: { orders: "pull" } });
      script({ orders: [order("o1", "paid")] });
      await scheduler.runDue(at(0));
      script({ orders: [order("o1", "paid"), order("o2", "paid")] });
      await scheduler.runDue(at(1_000));
      expect(notified.calls.map((call) => call.orderId)).toEqual(["o1", "o2"]);
    });

    it("an order the core refuses is logged and skipped; the run goes on and the cursor moves", async () => {
      const {
        scheduler,
        order: notified,
        script,
        stateOf,
        logged,
        said,
      } = await subject({
        strategy: { orders: "pull" },
        answers: { order: (request) => (request.orderId === "o1" ? fail(new Refused()) : ok(undefined)) },
      });
      script({ orders: [order("o1", "paid"), order("o2", "paid")] });
      await scheduler.runDue(at(0));
      expect(notified.calls.map((call) => call.orderId)).toEqual(["o1", "o2"]);
      expect(await stateOf("orders")).toMatchObject({ cursor: "2", lastOutcome: { status: "ok", count: 1 } });
      expect(logged).toEqual([
        "The core refused a change read from the platform; the run goes on without it.",
      ]);
      expect(said).toEqual([{ merchantId: A, flow: "orders", code: "refused-for-the-test" }]);
    });

    it("an unavailable store stops the run and the cursor stays: the cursor moves only after depositing", async () => {
      const {
        scheduler,
        order: notified,
        script,
        stateOf,
      } = await subject({
        strategy: { orders: "pull" },
        answers: {
          order: (request) => (request.orderId === "o2" ? fail(new LedgerUnavailable()) : ok(undefined)),
        },
      });
      script({ orders: [order("o1", "paid"), order("o2", "paid"), order("o3", "paid")] });
      await scheduler.runDue(at(0));
      expect(notified.calls.map((call) => call.orderId)).toEqual(["o1", "o2"]);
      expect(await stateOf("orders")).toMatchObject({
        cursor: undefined,
        lastOutcome: { status: "failed", reason: "ledger-unavailable" },
      });
    });

    it("returns are deposited from their own cursor, with the platform's instant or the observation's", async () => {
      const { scheduler, returned, script, stateOf } = await subject({ strategy: { returns: "pull" } });
      script({ returns: [{ orderId: "o1" }, { orderId: "o2", returnedAt: "2026-09-19T11:00:00.000Z" }] });
      await scheduler.runDue(at(4));
      expect(returned.calls.map((call) => [call.orderId, call.returnedAt])).toEqual([
        ["o1", at(4)],
        ["o2", new Date("2026-09-19T11:00:00.000Z")],
      ]);
      expect(await stateOf("returns")).toMatchObject({
        cursor: "2",
        lastOutcome: { status: "ok", count: 2 },
      });
    });
  });
});
