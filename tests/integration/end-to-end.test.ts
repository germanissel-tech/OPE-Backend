// Feature 044 — US5 (constitution X, 02 §6; research R-11): the whole circuit, by HTTP and the scheduler, with the
// test platform and no other: the catalogue and its stock and price read by `pull`, an event and its decision by
// the SDK, the exposure confirmed, and the order noticed by `subscribe` carrying the session of the decision →
// `ATTRIBUTED_ORDER`. The same run with the catalogue pushed and the order pulled ends the same: how a flow arrives
// changes nothing of what the core does with it.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { replace } from "../../src/composition/graph/index.js";
import { DecisionLedgerPort } from "../../src/composition/modules/ledger.js";
import { OrderLedgerPort } from "../../src/composition/modules/outcomes.js";
import { InstalledSourcesPort, PlatformSchedulerPort } from "../../src/composition/modules/platform.js";
import { ClockPort } from "../../src/composition/modules/shared-kernel.js";
import { asDecisionId } from "../../src/domain/ledger/index.js";
import { asOrderId } from "../../src/domain/outcomes/index.js";
import { asMerchantId } from "../../src/domain/shared-kernel/index.js";
import {
  installedSources,
  scriptedTestSource,
  type ScriptedProduct,
  type ScriptedTestSource,
} from "../../src/interface-adapters/platform/index.js";
import { json } from "../helpers/json.js";
import {
  admin,
  catalogProductOf,
  eventOf,
  fixedClock,
  postEvents,
  postExposure,
  putCatalog,
  sharedTestApp,
  type SharedApp,
} from "../helpers/test-app.js";
import type { components } from "#generated/api.js";

type IngestResult = components["schemas"]["IngestResult"];

const NOW = "2026-09-18T12:00:00.000Z";
const A = asMerchantId("m_a");
const SESSION = "ses_00000001";
const PAGE = { pageType: "product", productId: "SKU-1", variantId: "SKU-1-M" };
const before = (seconds: number): string => new Date(Date.parse(NOW) - seconds * 1000).toISOString();

let app: SharedApp;
let source: ScriptedTestSource;
beforeAll(async () => {
  app = await sharedTestApp({ ports: [replace(ClockPort, fixedClock(NOW))] });
});
beforeEach(async () => {
  source = scriptedTestSource();
  await app.resetPorts({
    ports: [replace(InstalledSourcesPort, installedSources(new Map([["test", source]])))],
  });
});
afterAll(async () => {
  await app.close();
});

async function configure(syncStrategy: Record<string, string>): Promise<void> {
  const res = await admin(app.app, "POST", "/v1/admin/merchants/m_a/configuration", {
    body: {
      declared: { platformSource: "test", syncStrategy, confirmedOrderStates: ["invoiced"] },
      corrective: true,
      reason: "the platform is read by OPE",
    },
  });
  expect(res.statusCode, res.body).toBe(201);
}

/** What the platform of the merchant holds: the product of the page, its stock, and the order of the session. */
function script(): void {
  source.script(A, {
    catalog: {
      capturedAt: before(60),
      products: [catalogProductOf("SKU-1", 2) as unknown as ScriptedProduct],
    },
    stockAndPrice: [
      {
        variantId: "SKU-1-M",
        available: true,
        price: { amount: "19990.00", currency: "ARS" },
        observedAt: before(30),
      },
    ],
    orders: [
      {
        orderId: "ORD-1",
        state: "invoiced",
        total: { amount: "19990.00", currency: "ARS" },
        items: [{ sku: "SKU-1-M", quantity: 1 }],
        confirmedAt: before(1),
        sessionId: SESSION,
      },
    ],
  });
}

const run = () => app.resolve(PlatformSchedulerPort).runDue(new Date(NOW));

let n = 0;
const ev = (seconds: number, over: Record<string, unknown>) =>
  eventOf(++n, { occurredAt: before(60 - seconds), page: PAGE, sessionId: SESSION, ...over });

/** The SDK: two interactions with the size selector and the size guide read, then the exposure of the decision. */
async function decideAndExpose(): Promise<string> {
  const res = await postEvents(
    app.app,
    {
      events: [
        ev(1, { type: "variant_selector_interacted" }),
        ev(2, { type: "variant_selector_interacted" }),
        ev(3, { type: "block_dwelled", block: "specifications", dwellMs: 6000 }),
      ],
    },
    { key: "key-a-1" },
  );
  expect(res.statusCode).toBe(202);
  const { decision } = json(res) as IngestResult;
  expect(decision.outcome).toBe("INTERVENE");
  const exposed = await postExposure(
    app.app,
    {
      decisionId: decision.decisionId,
      sessionId: SESSION,
      visitorId: "vis_00000001",
      exposedAt: NOW,
      anchor: "variant_selector",
    },
    { key: "key-a-1" },
  );
  expect(exposed.statusCode).toBe(201);
  return decision.decisionId;
}

/** What the run leaves: what the decision knew of the product, and where the order stands in the chain. */
async function outcome(decisionId: string) {
  const decision = await app.resolve(DecisionLedgerPort).find(A, asDecisionId(decisionId));
  const order = await app.resolve(OrderLedgerPort).find(A, asOrderId("ORD-1"));
  return {
    evidence: decision?.inference?.evidence,
    status: order?.status(),
    correlation: order?.correlationStatus(),
  };
}

describe("the circuit of the platform port", () => {
  it("catalogue and stock by pull, the decision and its exposure, the order by subscribe → ATTRIBUTED_ORDER", async () => {
    await configure({ catalog: "pull", stockAndPrice: "pull", orders: "subscribe", returns: "push" });
    script();
    await run();
    const decisionId = await decideAndExpose();
    const rotated = await admin(app.app, "POST", "/v1/admin/merchants/m_a/notice-keys", { body: {} });
    const key = (json(rotated) as { value: string }).value;
    const noticed = await app.app.inject({
      method: "POST",
      url: "/v1/platform-notices",
      headers: { "content-type": "application/json", "x-ope-notice-key": key },
      payload: JSON.stringify({ flow: "orders", reference: "ORD-1", state: "invoiced" }),
    });
    expect(noticed.statusCode).toBe(202);
    await run();
    expect(await outcome(decisionId)).toEqual({
      evidence: { truth: "known", stockAndPrice: "fresh", available: true },
      status: "ATTRIBUTED_ORDER",
      correlation: "ATTRIBUTED",
    });
  });

  it("the same run with the catalogue pushed and the order pulled ends the same", async () => {
    await configure({ catalog: "push", stockAndPrice: "push", orders: "pull", returns: "push" });
    script();
    const pushed = await putCatalog(
      app.app,
      { capturedAt: before(60), products: [catalogProductOf("SKU-1", 2)] },
      { platformKey: "platform-a-1" },
    );
    expect(pushed.statusCode).toBe(201);
    const decisionId = await decideAndExpose();
    await run();
    expect(await outcome(decisionId)).toEqual({
      evidence: { truth: "known", stockAndPrice: "fresh", available: true },
      status: "ATTRIBUTED_ORDER",
      correlation: "ATTRIBUTED",
    });
  });
});
