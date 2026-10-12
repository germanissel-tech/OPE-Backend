// Feature 044, US4 (FR-012; research R-08): an entry by a mode that does not govern its flow is refused. With
// the four flows of a merchant in `pull`, the four entrances of the `push` answer 409 and record nothing; another
// merchant is not touched; and a configuration version is the only thing that changes it back.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { replace } from "../../src/composition/graph/index.js";
import { CatalogStorePort } from "../../src/composition/modules/catalog.js";
import { OrderLedgerPort } from "../../src/composition/modules/outcomes.js";
import { ClockPort } from "../../src/composition/modules/shared-kernel.js";
import { asOrderId } from "../../src/domain/outcomes/index.js";
import { asMerchantId } from "../../src/domain/shared-kernel/index.js";
import { json, problemOf } from "../helpers/json.js";
import {
  admin,
  catalogOf,
  fixedClock,
  orderOf,
  postOrder,
  postRefresh,
  postReturn,
  putCatalog,
  sharedTestApp,
  type SharedApp,
} from "../helpers/test-app.js";

const NOW = "2026-09-18T12:00:00.000Z";
const CAPTURED = "2026-09-18T11:59:00.000Z";
const A = asMerchantId("m_a");

let app: SharedApp;
beforeAll(async () => {
  app = await sharedTestApp({ ports: [replace(ClockPort, fixedClock(NOW))] });
});
beforeEach(async () => {
  await app.resetPorts();
});
afterAll(async () => {
  await app.close();
});

const all = (mode: "push" | "pull") => ({ catalog: mode, stockAndPrice: mode, orders: mode, returns: mode });

async function configure(merchant: string, syncStrategy: Record<string, string>): Promise<void> {
  const res = await admin(app.app, "POST", `/v1/admin/merchants/${merchant}/configuration`, {
    // Corrective, because the merchant of the tests runs an experiment and its configuration is frozen.
    body: {
      declared: { platformSource: "test", syncStrategy, confirmedOrderStates: ["paid"] },
      corrective: true,
      reason: "the platform changes how it delivers",
    },
  });
  expect(res.statusCode).toBe(201);
}

/** The four entrances of the generic adapter, as the platform of `merchant` calls them. */
function entrances(platformKey: string) {
  const refreshItem = {
    variantId: "P1-M",
    available: true,
    price: { amount: "1.00", currency: "ARS" },
    observedAt: NOW,
  };
  const returned = { orderId: "ORD-1", returnedAt: NOW };
  return {
    catalog: () => putCatalog(app.app, catalogOf(1, CAPTURED), { platformKey }),
    stockAndPrice: () => postRefresh(app.app, { items: [refreshItem] }, { platformKey }),
    orders: () => postOrder(app.app, orderOf("ORD-1"), { platformKey }),
    returns: () => postReturn(app.app, returned, { platformKey }),
  };
}

describe("the entrance of the push, by the mode in force", () => {
  it("with the four flows in pull, the four entrances answer 409 sync-mode-not-configured and nothing is recorded", async () => {
    await configure("m_a", all("pull"));
    for (const [flow, enter] of Object.entries(entrances("platform-a-1"))) {
      const res = await enter();
      expect(res.statusCode, flow).toBe(409);
      expect(problemOf(res).type, flow).toBe("urn:ope:problem:sync-mode-not-configured");
      expect(problemOf(res).detail, flow).toBe(`The flow ${flow} of this merchant arrives by pull.`);
    }
    expect(await app.resolve(CatalogStorePort).current(A)).toBeUndefined();
    expect(await app.resolve(OrderLedgerPort).find(A, asOrderId("ORD-1"))).toBeUndefined();
  });

  it("each flow by its own mode: the catalogue in pull does not close the orders", async () => {
    await configure("m_a", { ...all("push"), catalog: "pull" });
    const enter = entrances("platform-a-1");
    expect((await enter.catalog()).statusCode).toBe(409);
    expect((await enter.orders()).statusCode).toBe(201);
  });

  it("another merchant is not touched: B keeps pushing while A pulls", async () => {
    await configure("m_a", all("pull"));
    const enter = entrances("platform-b-1");
    expect((await enter.catalog()).statusCode).toBe(201);
    expect(json(await enter.stockAndPrice())).toMatchObject({ applied: ["P1-M"] });
    expect((await enter.orders()).statusCode).toBe(201);
  });

  it("only a configuration version changes the mode back, and the entrance answers again without a restart", async () => {
    await configure("m_a", all("pull"));
    const enter = entrances("platform-a-1");
    expect((await enter.catalog()).statusCode).toBe(409);
    await configure("m_a", all("push"));
    expect((await enter.catalog()).statusCode).toBe(201);
  });
});
