// Feature 044, US4 (FR-006, FR-007, FR-008; ADR-047): the platform refreshes the stock and price of some variants
// without the rest of the catalogue. Only those change, each item answers what became of it, the invariants
// answer with their problem types, and every accepted refresh is a receipt of the synchronisation level.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { replace } from "../../src/composition/graph/index.js";
import { CatalogStorePort, ProductTruthPort } from "../../src/composition/modules/catalog.js";
import { ClockPort } from "../../src/composition/modules/shared-kernel.js";
import { asProductId, asVariantId } from "../../src/domain/catalog/index.js";
import { asMerchantId } from "../../src/domain/shared-kernel/index.js";
import { json, problemOf } from "../helpers/json.js";
import {
  catalogProductOf,
  fixedClock,
  postRefresh,
  putCatalog,
  sharedTestApp,
  type SharedApp,
} from "../helpers/test-app.js";
import { unavailableCatalogStore } from "../helpers/unavailable-ledgers.js";

const NOW = "2026-09-18T12:00:00.000Z";
const CAPTURED = "2026-09-18T11:00:00.000Z";
const PLATFORM_A = "platform-a-1";
const A = asMerchantId("m_a");
const at = (minutes: number) => new Date(new Date(NOW).getTime() + minutes * 60_000).toISOString();

const item = (variantId: string, observedAt: string, over: Record<string, unknown> = {}) => ({
  variantId,
  available: false,
  price: { amount: "15000.00", currency: "ARS" },
  observedAt,
  ...over,
});
const refresh = (...items: unknown[]) => postRefresh(app.app, { items }, { platformKey: PLATFORM_A });
const truthOf = (variantId: string) =>
  app.resolve(ProductTruthPort).lookup(A, asProductId("P1"), asVariantId(variantId));

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

/** One product with three variants (P1-M, P1-L, P1-S), captured an hour ago: stock and price already stale. */
async function catalogue(): Promise<void> {
  const snapshot = { capturedAt: CAPTURED, products: [catalogProductOf("P1", 3)] };
  expect((await putCatalog(app.app, snapshot, { platformKey: PLATFORM_A })).statusCode).toBe(201);
}

describe("POST /v1/catalog/refreshes", () => {
  it("two variants refreshed: only those change, and they are fresh while the third ages with the snapshot", async () => {
    await catalogue();
    expect(await truthOf("P1-M")).toMatchObject({ kind: "known", stockAndPrice: "stale" });
    const res = await refresh(item("P1-M", at(-1)), item("P1-L", at(-2), { available: true }));
    expect(res.statusCode).toBe(200);
    expect(json(res)).toEqual({ applied: ["P1-M", "P1-L"], repeated: [], superseded: [], unknown: [] });
    expect(await truthOf("P1-M")).toMatchObject({
      kind: "known",
      stockAndPrice: "fresh",
      variant: { available: false, price: { amount: "15000.00", currency: "ARS" } },
    });
    expect(await truthOf("P1-L")).toMatchObject({ stockAndPrice: "fresh", variant: { available: true } });
    expect(await truthOf("P1-S")).toMatchObject({
      stockAndPrice: "stale",
      variant: { available: true, price: { amount: "19990.00" } },
    });
  });

  it("the four outcomes: the same refresh repeats, an older one loses, an unknown variant is named", async () => {
    await catalogue();
    expect(json(await refresh(item("P1-M", at(-1))))).toMatchObject({ applied: ["P1-M"] });
    expect(json(await refresh(item("P1-M", at(-1))))).toEqual({
      applied: [],
      repeated: ["P1-M"],
      superseded: [],
      unknown: [],
    });
    const mixed = await refresh(
      item("P1-M", at(-2)),
      item("P1-L", "2026-09-18T10:00:00.000Z"),
      item("P1-M-OTHER", at(-1)),
      item("P1-S", at(-1)),
    );
    expect(json(mixed)).toEqual({
      applied: ["P1-S"],
      repeated: [],
      superseded: ["P1-M", "P1-L"],
      unknown: ["P1-M-OTHER"],
    });
    // The superseded refresh did not move the truth.
    expect(await truthOf("P1-M")).toMatchObject({ ageMs: 60_000 });
  });

  it("the same instant with other content loses: the platform does not correct a datum without moving its instant", async () => {
    await catalogue();
    await refresh(item("P1-M", at(-1)));
    expect(json(await refresh(item("P1-M", at(-1), { available: true })))).toMatchObject({
      superseded: ["P1-M"],
    });
    expect(await truthOf("P1-M")).toMatchObject({ variant: { available: false } });
  });

  it("a new snapshot newer than a refresh is the truth again", async () => {
    await catalogue();
    await refresh(item("P1-M", at(-10)));
    const later = { capturedAt: at(-5), products: [catalogProductOf("P1", 3)] };
    expect((await putCatalog(app.app, later, { platformKey: PLATFORM_A })).statusCode).toBe(201);
    expect(await truthOf("P1-M")).toMatchObject({ variant: { available: true }, ageMs: 5 * 60_000 });
    expect(await app.resolve(CatalogStorePort).refreshOf(A, asVariantId("P1-M"))).toBeUndefined();
  });

  it("[invariant:stock-and-price-duplicate-variant-id] the same variant twice: 422, and nothing was kept", async () => {
    await catalogue();
    const res = await refresh(item("P1-M", at(-2)), item("P1-M", at(-1)));
    expect(res.statusCode).toBe(422);
    expect(problemOf(res).type).toBe("urn:ope:problem:stock-and-price-duplicate-variant-id");
    expect(await truthOf("P1-M")).toMatchObject({ stockAndPrice: "stale" });
  });

  it("[invariant:stock-captured-in-future] an item observed beyond the tolerance: 422", async () => {
    await catalogue();
    const res = await refresh(item("P1-M", at(-1)), item("P1-L", at(6)));
    expect(res.statusCode).toBe(422);
    expect(problemOf(res).type).toBe("urn:ope:problem:stock-captured-in-future");
    expect(await truthOf("P1-M")).toMatchObject({ stockAndPrice: "stale" });
  });

  it("every accepted refresh is a receipt (research R-05); without a catalogue nothing is kept and nothing is received", async () => {
    const store = app.resolve(CatalogStorePort);
    expect(json(await refresh(item("P1-M", at(-1))))).toEqual({
      applied: [],
      repeated: [],
      superseded: [],
      unknown: ["P1-M"],
    });
    expect(await store.receipts(A)).toEqual([]);
    await catalogue();
    await refresh(item("P1-M", at(-1)));
    await refresh(item("P1-M", at(-1)));
    expect((await store.receipts(A)).map((d) => d.toISOString())).toEqual([NOW, NOW, NOW]);
  });

  it("a store that cannot keep the refresh: 503, and the platform retries", async () => {
    await app.resetPorts({ ports: [replace(CatalogStorePort, unavailableCatalogStore())] });
    const res = await refresh(item("P1-M", at(-1)));
    expect(res.statusCode).toBe(503);
  });
});
