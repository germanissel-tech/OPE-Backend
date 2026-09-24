// Feature 017 — US4 (spec scenarios 1–4; 01 §3.1.1, §14.2; constitution XI): the SDK reads with
// its ingest key what it may see of the configuration of its merchant — never a policy —, the
// kill switch travels with it, the anchors that stop resolving are kept per merchant for the
// operator, and nothing crosses merchants.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { replace } from "../../src/composition/graph/index.js";
import { ClockPort } from "../../src/composition/modules/shared-kernel.js";
import { PlatformConfiguration } from "../../src/domain/configuration/index.js";
import { json, problemOf } from "../helpers/json.js";
import {
  admin,
  fixedClock,
  merchantB,
  NOW,
  sharedTestApp,
  testLevels,
  type MerchantSpec,
  type SharedApp,
} from "../helpers/test-app.js";
import type { components } from "#generated/api.js";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";

type SdkConfig = components["schemas"]["SdkConfig"];
type DiagnosticPage = components["schemas"]["AnchorDiagnosticPage"];

const KEY = "key-a-1";
const A = "m_a";
const ANCHORS = { price: { selectors: [".price", "#price"] }, cta: { selectors: ["button.buy"] } };

/** A with an anchor map and languages declared from the seed; the whole traffic to OPE. */
const merchantA: MerchantSpec = {
  merchantId: A,
  ingestKeys: [KEY, "key-a-2"],
  platformKeys: ["platform-a-1"],
  origins: ["https://a.example"],
  evidenceProfile: { returnsPolicy: true, fitData: true },
  declared: {
    holdoutShare: 0,
    anchors: ANCHORS,
    locales: { supported: ["es-AR", "en"], fallback: "es-AR" },
    commercialPolicy: { version: "a-1", marginShare: 0.4 },
  },
  experiments: [
    { experimentId: "exp_a_000001", treatmentShare: 1, seed: "seed-a", status: "active", openedAt: NOW },
  ],
};

let app: SharedApp;
beforeAll(async () => {
  app = await sharedTestApp(
    { ports: [replace(ClockPort, fixedClock(NOW))] },
    { merchants: [merchantA, merchantB] },
  );
});
beforeEach(async () => {
  await app.resetPorts();
});
afterAll(async () => {
  await app.close();
});

const sdk = (
  a: FastifyInstance,
  method: "GET" | "POST",
  url: string,
  o: { key?: string; origin?: string; body?: unknown } = {},
): Promise<LightMyRequestResponse> => {
  const headers: Record<string, string> = { "x-ope-ingest-key": o.key ?? KEY };
  if (o.origin !== undefined) headers["origin"] = o.origin;
  if (o.body !== undefined) headers["content-type"] = "application/json";
  return a.inject({ method, url, headers, ...(o.body === undefined ? {} : { payload: o.body as object }) });
};
const config = (o: { key?: string; origin?: string } = {}) => sdk(app.app, "GET", "/v1/sdk/config", o);
const report = (body: unknown, o: { key?: string; origin?: string } = {}) =>
  sdk(app.app, "POST", "/v1/sdk/diagnostics", { ...o, body });
const diagnosticsOf = async (merchant = A): Promise<DiagnosticPage> =>
  json(await admin(app.app, "GET", `/v1/admin/merchants/${merchant}/anchor-diagnostics`)) as DiagnosticPage;

describe("GET /v1/sdk/config (scenarios 1, 2)", () => {
  it("answers the anchor map, the surfaces, the languages, the switch and the versions in force; never cacheable", async () => {
    const res = await config();
    expect(res.statusCode).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(json(res)).toEqual({
      enabled: true,
      versions: { platform: "platform-1", defaults: "defaults-1", merchant: 1 },
      surfaces: ["product", "cart"],
      locales: { supported: ["es-AR", "en"], fallback: "es-AR" },
      anchors: ANCHORS,
    });
  });

  it("nothing the constitution reserves to the backend travels: no policy, margin, ladder, split, arm nor experiment", async () => {
    const body = json(await config()) as SdkConfig;
    expect(Object.keys(body).sort()).toEqual(["anchors", "enabled", "locales", "surfaces", "versions"]);
    expect(JSON.stringify(body)).not.toMatch(
      /policy|margin|incentive|treatment|arm|experiment|seed|holdout/i,
    );
  });

  it("a published version is served on the next request with its number; without an anchor map the field is absent", async () => {
    const published = await admin(app.app, "POST", `/v1/admin/merchants/${A}/configuration`, {
      body: {
        declared: { holdoutShare: 0, surfaces: ["product"], locales: { supported: ["en"] } },
        corrective: true,
        reason: "redesign",
      },
    });
    expect(published.statusCode).toBe(201);
    const body = json(await config()) as SdkConfig;
    expect(body.versions.merchant).toBe(2);
    expect(body.surfaces).toEqual(["product"]);
    expect(body.locales).toEqual({ supported: ["en"] });
    expect(body).not.toHaveProperty("anchors");
  });

  it("with the kill switch off the SDK gets enabled: false and may stay silent", async () => {
    const off = await admin(app.app, "PUT", `/v1/admin/merchants/${A}/kill-switch`, {
      body: { enabled: false },
    });
    expect(off.statusCode).toBe(200);
    const body = json(await config()) as SdkConfig;
    expect(body.enabled).toBe(false);
    expect(body.versions.merchant).toBe(1);
  });

  it("without a credential 401; with an Origin the merchant did not register 403", async () => {
    const missing = await app.app.inject({ method: "GET", url: "/v1/sdk/config" });
    expect(missing.statusCode).toBe(401);
    const foreign = await config({ origin: "https://b.example" });
    expect(foreign.statusCode).toBe(403);
    expect(problemOf(foreign)).toMatchObject({ type: "urn:ope:problem:origin-not-allowed" });
    expect((await config({ origin: "https://a.example" })).statusCode).toBe(200);
  });
});

describe("POST /v1/sdk/diagnostics and GET .../anchor-diagnostics (scenario 3)", () => {
  it("a report is kept per anchor, page type and version with the instant and a counter; an operator reads it", async () => {
    const res = await report({
      configurationVersion: 1,
      unresolved: [
        { anchor: "size_selector", pageType: "product" },
        { anchor: "cta", pageType: "product" },
      ],
    });
    expect(res.statusCode).toBe(202);
    expect(json(res)).toEqual({ received: 2 });
    const page = await diagnosticsOf();
    expect(page.items).toEqual([
      { anchor: "cta", pageType: "product", configurationVersion: 1, lastSeenAt: NOW, count: 1 },
      { anchor: "size_selector", pageType: "product", configurationVersion: 1, lastSeenAt: NOW, count: 1 },
    ]);
  });

  it("a burst of the same anchor is one row with a higher count, most recent first; without a version the key is its own", async () => {
    for (let i = 0; i < 5; i += 1) {
      expect((await report({ unresolved: [{ anchor: "price", pageType: "cart" }] })).statusCode).toBe(202);
    }
    await report({ configurationVersion: 1, unresolved: [{ anchor: "price", pageType: "cart" }] });
    const page = await diagnosticsOf();
    expect(page.items.map((d) => [d.anchor, d.configurationVersion, d.count])).toEqual([
      ["price", 1, 1],
      ["price", undefined, 5],
    ]);
  });

  it("the report carries only anchors of the vocabulary and page types: anything else is 400", async () => {
    expect((await report({ unresolved: [] })).statusCode).toBe(400);
    expect((await report({ unresolved: [{ anchor: "hero", pageType: "product" }] })).statusCode).toBe(400);
    expect(
      (await report({ unresolved: [{ anchor: "cta", pageType: "product", url: "https://a.example/p/1" }] }))
        .statusCode,
    ).toBe(400);
  });

  it("the platform keeps a bounded number per merchant: past the limit the oldest is discarded", async () => {
    const levels = testLevels();
    const platform = PlatformConfiguration.rehydrate({
      ...levels.platform.record(),
      anchorDiagnosticsKept: 2,
    });
    await app.resetPorts({ config: { merchants: [merchantA, merchantB], levels: { ...levels, platform } } });
    await report({ unresolved: [{ anchor: "price", pageType: "product" }] });
    await report({ unresolved: [{ anchor: "cta", pageType: "product" }] });
    await report({ unresolved: [{ anchor: "policies", pageType: "product" }] });
    const page = await diagnosticsOf();
    expect(page.items.map((d) => d.anchor)).toEqual(["policies", "cta"]);
  });
});

describe("isolation (scenario 4)", () => {
  it("the key of B sees and affects only what is of B; an operator scoped to A cannot read the diagnostics of B", async () => {
    await report({ unresolved: [{ anchor: "price", pageType: "product" }] });
    const ofB = json(await config({ key: "key-b-1" })) as SdkConfig;
    expect(ofB.versions).toEqual({ platform: "platform-1", defaults: "defaults-1", merchant: 1 });
    expect(ofB).not.toHaveProperty("anchors");
    expect(
      (await report({ unresolved: [{ anchor: "cta", pageType: "cart" }] }, { key: "key-b-1" })).statusCode,
    ).toBe(202);
    expect((await diagnosticsOf()).items.map((d) => d.anchor)).toEqual(["price"]);
    expect((await diagnosticsOf("m_b")).items.map((d) => [d.anchor, d.pageType])).toEqual([["cta", "cart"]]);
    const denied = await admin(app.app, "GET", "/v1/admin/merchants/m_b/anchor-diagnostics", { as: "ops-a" });
    expect(denied.statusCode).toBe(403);
  });
});
