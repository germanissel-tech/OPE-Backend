// Feature 017 — US2 (spec scenarios 1–7; FR-010..FR-017; constitution XI): the configuration
// is versioned and no policy lives in the code. The levels of the release by API, a version
// published for a merchant, what the next decision stamps and obeys, the invariants, and the
// isolation between merchants.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { asDecisionId } from "../../src/domain/ledger/index.js";
import { asMerchantId } from "../../src/domain/shared-kernel/index.js";
import { json, problemOf } from "../helpers/json.js";
import {
  admin,
  catalogProductOf,
  eventOf,
  fixedClock,
  merchantB,
  NOW,
  postEvents,
  putCatalog,
  sharedTestApp,
  type MerchantSpec,
  type SharedApp,
} from "../helpers/test-app.js";
import type { components } from "#generated/api.js";

type IngestResult = components["schemas"]["IngestResult"];
type Version = components["schemas"]["MerchantConfigurationVersion"];
type Configuration = components["schemas"]["MerchantConfiguration"];

const KEY = "key-a-1";
const PAGE = { pageType: "product", productId: "SKU-1", variantId: "SKU-1-M" };
const A = "m_a";
const ONE_MINUTE = 60_000;
const TWO_MINUTES = 2 * ONE_MINUTE;

/** A, in treatment for everyone, with a merchant version from the seed (what it declares of its configuration). */
const merchantA: MerchantSpec = {
  merchantId: A,
  ingestKeys: [KEY],
  platformKeys: ["platform-a-1"],
  origins: ["https://a.example"],
  evidenceProfile: { returnsPolicy: true, fitData: true },
  declared: { holdoutPercent: 0 },
  experiments: [
    { experimentId: "exp_a_000001", treatmentPercent: 100, seed: "seed-a", status: "active", openedAt: NOW },
  ],
};

let app: SharedApp;
beforeAll(async () => {
  app = await sharedTestApp({ ports: { clock: fixedClock(NOW) } }, { merchants: [merchantA, merchantB] });
});
beforeEach(async () => {
  await app.resetPorts();
});
afterAll(async () => {
  await app.close();
});

let n = 0;
const at = (seconds: number): string =>
  new Date(new Date(NOW).getTime() - ONE_MINUTE + seconds * 1000).toISOString();
const ev = (seconds: number, over: Record<string, unknown>): Record<string, unknown> =>
  eventOf(++n, { occurredAt: at(seconds), page: PAGE, ...over });
const priceRead = (s: number) => ev(s, { type: "block_dwelled", block: "price", dwellMs: 8000 });
const cta = (s: number) => ev(s, { type: "cta_approached", approach: "hover" });

const configure = (body: unknown, o: { as?: "ops-all" | "ops-a"; merchant?: string } = {}) =>
  admin(app.app, "POST", `/v1/admin/merchants/${o.merchant ?? A}/configuration`, {
    body,
    ...(o.as ? { as: o.as } : {}),
  });
const configurationOf = async (merchant = A): Promise<Configuration> =>
  json(await admin(app.app, "GET", `/v1/admin/merchants/${merchant}/configuration`)) as Configuration;

/** A decision of A with a price signal on a catalogue captured two minutes before now. */
async function decide(session = "ses_00000001"): Promise<IngestResult> {
  const captured = new Date(new Date(NOW).getTime() - TWO_MINUTES).toISOString();
  const put = await putCatalog(
    app.app,
    { capturedAt: captured, products: [catalogProductOf("SKU-1", 2)] },
    { platformKey: "platform-a-1" },
  );
  expect([200, 201]).toContain(put.statusCode);
  const res = await postEvents(
    app.app,
    { events: [priceRead(1), cta(2)].map((e) => ({ ...e, sessionId: session })) },
    { key: KEY },
  );
  expect(res.statusCode).toBe(202);
  return json(res) as IngestResult;
}

const recorded = (decisionId: string) => app.ports.decisions.find(asMerchantId(A), asDecisionId(decisionId));

describe("the levels of the release (scenario 4)", () => {
  it("any operator reads the platform configuration and the treatment defaults with their versions; nothing writes them", async () => {
    const platform = await admin(app.app, "GET", "/v1/admin/platform-configuration", { as: "ops-a" });
    expect(platform.statusCode).toBe(200);
    expect(json(platform)).toMatchObject({
      version: "platform-1",
      dedupWindow: { ttlMs: 86_400_000, maxIds: 100_000 },
      clockSkewToleranceMs: 300_000,
      rotationGraceMaxMs: 604_800_000,
    });
    const defaults = await admin(app.app, "GET", "/v1/admin/treatment-defaults", { as: "ops-a" });
    expect(defaults.statusCode).toBe(200);
    expect(json(defaults)).toMatchObject({
      version: "defaults-1",
      freshness: { catalogMs: 129_600_000, stockAndPriceMs: 900_000 },
      holdoutPercent: 5,
      decisionPolicy: { version: "default-1" },
      commercialPolicy: { version: "commercial-default-1", incentiveLadderPercent: [5, 10] },
      surfaces: ["product", "cart"],
      syncStrategy: { catalog: "push", stockAndPrice: "push", orders: "push", returns: "push" },
    });
    expect(json(defaults)).not.toHaveProperty("anchors");
    expect((await admin(app.app, "PUT", "/v1/admin/platform-configuration", { body: {} })).statusCode).toBe(
      405,
    );
  });
});

describe("a merchant without a version (scenario 1)", () => {
  it("decides with the defaults and the platform of the release and stamps the two versions, without a merchant one", async () => {
    const created = json(
      await admin(app.app, "POST", "/v1/admin/merchants", {
        body: { origins: ["https://new.example"], signature: false },
      }),
    ) as { merchant: { merchantId: string }; credentials: { ingestKey: string } };
    const id = created.merchant.merchantId;
    const configuration = await configurationOf(id);
    expect(configuration.versions).toEqual({ platform: "platform-1", defaults: "defaults-1" });
    expect(configuration.declared).toEqual({});
    expect(configuration.effective.freshness).toEqual({ catalogMs: 129_600_000, stockAndPriceMs: 900_000 });
    expect(configuration.effective.platform.version).toBe("platform-1");
    const res = await postEvents(app.app, { events: [priceRead(1)] }, { key: created.credentials.ingestKey });
    expect(res.statusCode).toBe(202);
    const decision = (json(res) as IngestResult).decision;
    expect(decision.reason).toBe("no-active-experiment");
    const kept = await app.ports.decisions.find(asMerchantId(id), asDecisionId(decision.decisionId));
    expect(kept?.configuration).toEqual({ platform: "platform-1", defaults: "defaults-1" });
    expect(JSON.stringify(json(res))).not.toMatch(/platform-1|defaults-1/);
  });
});

describe("publishing a version (scenarios 2, 3, 7)", () => {
  it("the seed is the version 1; a version that declares the freshness and the languages is numbered, the previous one stays, the next decision stamps and obeys it", async () => {
    const before = await configurationOf();
    expect(before.versions).toEqual({ platform: "platform-1", defaults: "defaults-1", merchant: 1 });
    expect(before.declared).toEqual({
      evidenceProfile: { returnsPolicy: true, fitData: true },
      holdoutPercent: 0,
    });
    const fresh = await decide("ses_00000001");
    expect((await recorded(fresh.decision.decisionId))?.configuration).toEqual({
      platform: "platform-1",
      defaults: "defaults-1",
      merchant: 1,
    });
    expect((await recorded(fresh.decision.decisionId))?.inference?.evidence).toMatchObject({
      stockAndPrice: "fresh",
    });

    // An experiment is active: the version must be corrective, with its reason (03 §4.10).
    const frozen = await configure({ declared: { freshness: { stockAndPriceMs: ONE_MINUTE } } });
    expect(frozen.statusCode).toBe(409);
    expect(problemOf(frozen)).toMatchObject({ type: "urn:ope:problem:configuration-frozen" });
    const published = await configure({
      declared: {
        freshness: { stockAndPriceMs: ONE_MINUTE },
        locales: { supported: ["es-AR", "en"], fallback: "es-AR" },
      },
      corrective: true,
      reason: "stock moves every minute",
    });
    expect(published.statusCode, published.body).toBe(201);
    const version = json(published) as Version;
    expect(version).toMatchObject({
      version: 2,
      corrective: true,
      reason: "stock moves every minute",
      publishedAt: NOW,
      operatorId: "ops-all",
      declared: {
        freshness: { stockAndPriceMs: ONE_MINUTE },
        locales: { supported: ["es-AR", "en"], fallback: "es-AR" },
      },
    });

    const after = await configurationOf();
    expect(after.versions).toEqual({ platform: "platform-1", defaults: "defaults-1", merchant: 2 });
    expect(after.effective.freshness).toEqual({ catalogMs: 129_600_000, stockAndPriceMs: ONE_MINUTE });
    expect(after.effective.locales).toEqual({ supported: ["es-AR", "en"], fallback: "es-AR" });
    expect(after.effective.evidenceProfile).toEqual({
      returnsPolicy: false,
      fitData: false,
      authorizedAttributes: [],
    });
    expect(after.effective.commercialPolicy.version).toBe("commercial-default-1");
    const versions = json(await admin(app.app, "GET", `/v1/admin/merchants/${A}/configuration/versions`)) as {
      items: Version[];
    };
    expect(versions.items.map((v) => v.version)).toEqual([2, 1]);

    // The catalogue captured two minutes ago is stale under the new window: the price barrier holds no evidence (no reset of the ports).
    const stale = await decide("ses_00000002");
    expect(stale.decision).toMatchObject({ outcome: "NO_OP", reason: "evidence-stale" });
    const kept = await recorded(stale.decision.decisionId);
    expect(kept?.configuration).toEqual({ platform: "platform-1", defaults: "defaults-1", merchant: 2 });
    expect(kept?.inference?.evidence).toMatchObject({ stockAndPrice: "stale" });
    expect(JSON.stringify(stale)).not.toMatch(/platform-1|defaults-1|"merchant"/);
  });

  it("publishing what the version in force declares repeats it with 200 and the same number; the log names the version and the reason", async () => {
    const body = { declared: { holdoutPercent: 10 }, corrective: true, reason: "keep some traffic out" };
    const first = await configure(body);
    expect(first.statusCode).toBe(201);
    const again = await configure(body);
    expect(again.statusCode).toBe(200);
    expect((json(again) as Version).version).toBe((json(first) as Version).version);
    const log = json(await admin(app.app, "GET", `/v1/admin/merchants/${A}/log`)) as {
      items: {
        operation: string;
        outcome: string;
        result?: { configurationVersion?: number };
        reason?: string;
      }[];
    };
    expect(log.items[0]).toMatchObject({
      operation: "publishMerchantConfiguration",
      outcome: "accepted",
      result: { configurationVersion: 2 },
      reason: "keep some traffic out",
    });
  });

  it("[invariant:invalid-configuration-value] an invalid value is refused naming the field, and no version is created", async () => {
    const cases: [unknown, string][] = [
      [
        { commercialPolicy: { version: "c-2", incentiveLadderPercent: [10, 5] } },
        "/declared/commercialPolicy/incentiveLadderPercent/1",
      ],
      [{ decisionPolicy: { version: "d-2", priority: ["fit"] } }, "/declared/decisionPolicy/priority"],
      [{ locales: { supported: ["es"], fallback: "en" } }, "/declared/locales/fallback"],

      [{ anchors: { price: { selectors: [".p", " "] } } }, "/declared/anchors/price/selectors/1"],
    ];
    for (const [declared, pointer] of cases) {
      const res = await configure({ declared, corrective: true, reason: "test" });
      expect(res.statusCode, JSON.stringify(declared)).toBe(422);
      const problem = problemOf(res);
      expect(problem.type).toBe("urn:ope:problem:invalid-configuration-value");
      expect(problem.errors?.[0]?.pointer).toBe(pointer);
    }
    expect((await configurationOf()).versions.merchant).toBe(1);
    const unknownField = await configure({
      declared: { freshness: { catalogMs: 1, stockAndPriceMs: 1, cache: 1 } },
    });
    expect(unknownField.statusCode).toBe(400);
  });

  it("[invariant:configuration-reason-required] a corrective version without a reason is refused", async () => {
    const res = await configure({ declared: { holdoutPercent: 0 }, corrective: true });
    expect(res.statusCode).toBe(422);
    expect(problemOf(res)).toMatchObject({
      type: "urn:ope:problem:configuration-reason-required",
      errors: [{ pointer: "/reason" }],
    });
  });

  it("the anchor map of the version is served in the effective configuration and to nobody else", async () => {
    const published = await configure({
      declared: { anchors: { price: { selectors: [".price", "#price"] } } },
      corrective: true,
      reason: "anchors",
    });
    expect(published.statusCode).toBe(201);
    const configuration = await configurationOf();
    expect(configuration.effective.anchors).toEqual({ price: { selectors: [".price", "#price"] } });
    expect(configuration.declared.anchors).toEqual({ price: { selectors: [".price", "#price"] } });
    expect((await configurationOf("m_b")).effective).not.toHaveProperty("anchors");
  });

  it("isolation: the version of A changes nothing for B, and an operator scoped to A cannot read nor publish for B", async () => {
    await configure({
      declared: { holdoutPercent: 0, freshness: { stockAndPriceMs: ONE_MINUTE } },
      corrective: true,
      reason: "a",
    });
    const b = await configurationOf("m_b");
    expect(b.effective.freshness.stockAndPriceMs).toBe(900_000);
    expect(b.versions.merchant).toBe(1);
    expect(
      (await admin(app.app, "GET", "/v1/admin/merchants/m_b/configuration", { as: "ops-a" })).statusCode,
    ).toBe(403);
    expect((await configure({ declared: {} }, { as: "ops-a", merchant: "m_b" })).statusCode).toBe(403);
    expect(
      (await admin(app.app, "GET", "/v1/admin/merchants/m_b/configuration/versions", { as: "ops-a" }))
        .statusCode,
    ).toBe(403);
  });
});
