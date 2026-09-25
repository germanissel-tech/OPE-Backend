// Feature 027 — US3 (FR-020..FR-022): the catalogue never degrades in silence. What a merchant's
// catalogue brings that OPE has no word for is kept per merchant and read by an operator of its
// scope; mapping a value takes it off the report without republishing the catalogue.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { replace } from "../../src/composition/graph/index.js";
import { ClockPort } from "../../src/composition/modules/shared-kernel.js";
import { PlatformConfiguration } from "../../src/domain/configuration/index.js";
import { json, problemOf } from "../helpers/json.js";
import {
  admin,
  catalogProductOf,
  fixedClock,
  merchantB,
  NOW,
  putCatalog,
  sharedTestApp,
  testLevels,
  type MerchantSpec,
  type SharedApp,
} from "../helpers/test-app.js";
import type { components } from "#generated/api.js";
import type { LightMyRequestResponse } from "fastify";

type Page = components["schemas"]["UnmappedAttributeValuePage"];

const A = "m_a";
const CAPTURED = "2026-09-18T11:59:00.000Z";
const LATER = "2026-09-18T11:59:30.000Z";

/** A declares the correspondence of one of its fabrics; the rest of its catalogue OPE cannot name. */
const merchantA: MerchantSpec = {
  merchantId: A,
  ingestKeys: ["key-a-1"],
  platformKeys: ["platform-a-1"],
  origins: ["https://a.example"],
  evidenceProfile: { returnsPolicy: true, fitData: true },
  declared: {
    holdoutShare: 0,
    attributeLabels: [{ label: "Denim 12oz", value: "denim" }],
  },
  experiments: [],
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

/** A garment of the shop, with what it is made of as the shop writes it. */
const garment = (id: string, material: string) =>
  catalogProductOf(id, 1, { attributes: [{ key: "material", value: material }] });
const publish = (products: Record<string, unknown>[], capturedAt = CAPTURED, merchant = "platform-a-1") =>
  putCatalog(app.app, { capturedAt, products }, { platformKey: merchant });
const reportOf = (merchant = A, o: { as?: "ops-all" | "ops-a" } = {}): Promise<LightMyRequestResponse> =>
  admin(app.app, "GET", `/v1/admin/merchants/${merchant}/unmapped-attribute-values`, o);
const pageOf = async (merchant = A): Promise<Page> => json(await reportOf(merchant)) as Page;
/** What two answers have to have in common: everything but the request each one answers. */
const said = (problem: ReturnType<typeof problemOf>): Record<string, unknown> => ({
  type: problem.type,
  title: problem.title,
  detail: problem.detail,
  status: problem.status,
});

describe("GET /v1/admin/merchants/{merchantId}/unmapped-attribute-values (scenarios 1–3)", () => {
  it("each unmapped label with how many products carry it and since when; a mapped one is not there", async () => {
    const res = await publish([
      garment("P1", "Frisa"),
      garment("P2", "Frisa"),
      garment("P3", "Denim 12oz"),
      garment("P4", "Nylon"),
    ]);
    expect(res.statusCode).toBe(201);
    const page = await pageOf();
    expect(page.items).toEqual([
      { label: "Nylon", products: 1, firstSeenAt: NOW, lastSeenAt: NOW },
      { label: "Frisa", products: 2, firstSeenAt: NOW, lastSeenAt: NOW },
    ]);
  });

  it("a value the merchant maps afterwards stops being listed, without republishing the catalogue", async () => {
    await publish([garment("P1", "Frisa"), garment("P2", "Nylon")]);
    expect((await pageOf()).items.map((v) => v.label)).toEqual(["Nylon", "Frisa"]);
    const published = await admin(app.app, "POST", `/v1/admin/merchants/${A}/configuration`, {
      body: {
        declared: {
          attributeLabels: [
            { label: "Denim 12oz", value: "denim" },
            { label: "Frisa", value: "jersey" },
          ],
        },
      },
    });
    expect(published.statusCode).toBe(201);
    expect((await pageOf()).items.map((v) => v.label)).toEqual(["Nylon"]);
  });

  it("the report never refuses nor delays the ingestion: past the limit the oldest is discarded", async () => {
    const levels = testLevels();
    const platform = PlatformConfiguration.rehydrate({ ...levels.platform.record(), unmappedValuesKept: 2 });
    await app.resetPorts({ config: { merchants: [merchantA, merchantB], levels: { ...levels, platform } } });
    const res = await publish([garment("P1", "Frisa"), garment("P2", "Nylon"), garment("P3", "Lycra")]);
    expect(res.statusCode).toBe(201);
    expect((json(res) as { products: number }).products).toBe(3);
    expect((await pageOf()).items.map((v) => v.label)).toEqual(["Lycra", "Nylon"]);
  });

  it("a catalogue that no longer brings the label leaves the report empty", async () => {
    await publish([garment("P1", "Frisa")]);
    expect((await pageOf()).items).toHaveLength(1);
    await publish([garment("P1", "Denim 12oz")], LATER);
    expect((await pageOf()).items).toEqual([]);
  });

  it("an operator outside the scope gets the same body as for a merchant that does not exist", async () => {
    await publish([garment("P1", "Frisa")]);
    const foreign = await reportOf("m_b", { as: "ops-a" });
    expect(foreign.statusCode).toBe(403);
    expect(problemOf(foreign).type).toBe("urn:ope:problem:merchant-out-of-scope");
    // The same problem, and the same detail: nothing tells an operator whether the merchant exists.
    // Only `instance` differs, because it is the request it answers.
    const missing = await reportOf("m_zzz", { as: "ops-a" });
    expect(missing.statusCode).toBe(403);
    expect(said(problemOf(missing))).toEqual(said(problemOf(foreign)));
  });

  it("what is of B is not read for A: each merchant sees its own gaps", async () => {
    await publish([garment("P1", "Frisa")]);
    await publish([garment("P1", "Nylon")], CAPTURED, "platform-b-1");
    expect((await pageOf()).items.map((v) => v.label)).toEqual(["Frisa"]);
    expect((await pageOf("m_b")).items.map((v) => v.label)).toEqual(["Nylon"]);
  });
});
