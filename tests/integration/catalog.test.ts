// US1 and US2 (FR-001..FR-007, FR-020, FR-024; ADR-025): the platform replaces the catalogue
// with its credential; invariants and idempotency answer with their problem types; the truth
// is readable right after.
import { afterEach, describe, expect, it } from "vitest";
import { productTruthOf } from "../../src/composition/modules/catalog.js";
import { asProductId, asVariantId } from "../../src/domain/catalog/index.js";
import { asMerchantId } from "../../src/domain/shared-kernel/index.js";
import { json, problemOf } from "../helpers/json.js";
import { catalogOf, catalogProductOf, fixedClock, putCatalog, startTestApp } from "../helpers/test-app.js";
import { unavailableCatalogStore } from "../helpers/unavailable-ledgers.js";
import type { App } from "../../src/composition/bootstrap.js";
import type { components } from "../../src/interface-adapters/http/client.js";

type Summary = components["schemas"]["CatalogSummary"];

const NOW = "2026-09-18T12:00:00.000Z";
const CAPTURED = "2026-09-18T11:59:00.000Z";
const PLATFORM_A = "platform-a-1";
const A = asMerchantId("m_a");

let app: App;
afterEach(async () => {
  await app.close();
});

describe("PUT /v1/catalog", () => {
  it("a valid snapshot is created: 201 with the summary, and its variants are readable truth", async () => {
    app = await startTestApp({ ports: { clock: fixedClock(NOW) } });
    const res = await putCatalog(app.app, catalogOf(3, CAPTURED), { platformKey: PLATFORM_A });
    expect(res.statusCode).toBe(201);
    expect(json(res)).toEqual({ products: 3, variants: 3, receivedAt: NOW, observedSyncLevel: 1 });
    const truth = await productTruthOf(app.ports).lookup(A, asProductId("P2"), asVariantId("P2-M"));
    expect(truth).toMatchObject({
      kind: "known",
      variant: { size: "M", available: true },
      freshness: { stockAndPrice: "fresh" },
    });
  });

  it("a store that cannot keep the snapshot → 503 ledger-unavailable with Retry-After, nothing replaced (F-044, ADR-021)", async () => {
    app = await startTestApp({ ports: { clock: fixedClock(NOW), catalog: unavailableCatalogStore() } });
    const res = await putCatalog(app.app, catalogOf(3, CAPTURED), { platformKey: PLATFORM_A });
    expect(res.statusCode).toBe(503);
    expect(res.headers["retry-after"]).toBe("5");
    expect(problemOf(res).type).toBe("urn:ope:problem:ledger-unavailable");
    expect(await app.ports.catalog.current(A)).toBeUndefined();
  });

  it("a newer snapshot replaces the whole catalogue: products that no longer come disappear", async () => {
    app = await startTestApp({ ports: { clock: fixedClock(NOW) } });
    await putCatalog(app.app, catalogOf(3, CAPTURED), { platformKey: PLATFORM_A });
    const res = await putCatalog(app.app, catalogOf(1, "2026-09-18T11:59:30.000Z"), {
      platformKey: PLATFORM_A,
    });
    expect(res.statusCode).toBe(201);
    expect((json(res) as Summary).products).toBe(1);
    expect(await productTruthOf(app.ports).lookup(A, asProductId("P3"), asVariantId("P3-M"))).toEqual({
      kind: "unknown",
      reason: "unknown-product",
    });
  });

  it("idempotency (ADR-020): the same snapshot twice → 200 with the same summary; same capture, other content → 409", async () => {
    app = await startTestApp({ ports: { clock: fixedClock(NOW) } });
    const first = await putCatalog(app.app, catalogOf(2, CAPTURED), { platformKey: PLATFORM_A });
    const again = await putCatalog(app.app, catalogOf(2, CAPTURED), { platformKey: PLATFORM_A });
    expect(first.statusCode).toBe(201);
    expect(again.statusCode).toBe(200);
    expect(json(again)).toEqual(json(first));
    const other = await putCatalog(app.app, catalogOf(1, CAPTURED), { platformKey: PLATFORM_A });
    expect(other.statusCode).toBe(409);
    expect(problemOf(other)).toMatchObject({
      type: "urn:ope:problem:idempotency-conflict",
      instance: "/v1/catalog",
    });
    expect(await productTruthOf(app.ports).lookup(A, asProductId("P2"), asVariantId("P2-M"))).toMatchObject({
      kind: "known",
    });
  });

  it("an empty snapshot is accepted: no catalogue, no truth", async () => {
    app = await startTestApp({ ports: { clock: fixedClock(NOW) } });
    await putCatalog(app.app, catalogOf(2, CAPTURED), { platformKey: PLATFORM_A });
    const res = await putCatalog(app.app, catalogOf(0, "2026-09-18T11:59:30.000Z"), {
      platformKey: PLATFORM_A,
    });
    expect(res.statusCode).toBe(201);
    expect(json(res)).toMatchObject({ products: 0, variants: 0 });
    expect(await productTruthOf(app.ports).lookup(A, asProductId("P1"), asVariantId("P1-M"))).toEqual({
      kind: "unknown",
      reason: "unknown-product",
    });
  });

  it.each([
    [
      "catalog-duplicate-product-id",
      { capturedAt: CAPTURED, products: [catalogProductOf("P1"), catalogProductOf("P1")] },
    ],
    [
      "catalog-duplicate-variant-id",
      {
        capturedAt: CAPTURED,
        products: [
          catalogProductOf("P1"),
          catalogProductOf("P2", 1, {
            variants: [
              {
                variantId: "P1-M",
                size: "M",
                color: "black",
                available: true,
                price: { amount: "1.00", currency: "ARS" },
              },
            ],
          }),
        ],
      },
    ],
    ["catalog-captured-in-future", catalogOf(1, "2026-09-18T12:06:00.000Z")],
  ])("[invariant:%s] → 422 with the problem type and the current snapshot intact", async (slug, body) => {
    app = await startTestApp({ ports: { clock: fixedClock(NOW) } });
    await putCatalog(app.app, catalogOf(1, "2026-09-18T11:00:00.000Z"), { platformKey: PLATFORM_A });
    const res = await putCatalog(app.app, body, { platformKey: PLATFORM_A });
    expect(res.statusCode).toBe(422);
    expect(problemOf(res)).toMatchObject({
      type: `urn:ope:problem:${slug}`,
      status: 422,
      instance: "/v1/catalog",
    });
    expect(await productTruthOf(app.ports).lookup(A, asProductId("P1"), asVariantId("P1-M"))).toMatchObject({
      kind: "known",
    });
  });

  it("[invariant:catalog-out-of-order] an older capture than the current one → 422, current intact", async () => {
    app = await startTestApp({ ports: { clock: fixedClock(NOW) } });
    await putCatalog(app.app, catalogOf(2, CAPTURED), { platformKey: PLATFORM_A });
    const res = await putCatalog(app.app, catalogOf(1, "2026-09-18T10:00:00.000Z"), {
      platformKey: PLATFORM_A,
    });
    expect(res.statusCode).toBe(422);
    expect(problemOf(res)).toMatchObject({ type: "urn:ope:problem:catalog-out-of-order" });
    expect(await productTruthOf(app.ports).lookup(A, asProductId("P2"), asVariantId("P2-M"))).toMatchObject({
      kind: "known",
    });
  });

  it("without the platform credential, or with the ingest key in its place → 401 before the body is read", async () => {
    app = await startTestApp({ ports: { clock: fixedClock(NOW) } });
    const none = await putCatalog(app.app, { not: "a snapshot" }, {});
    expect(none.statusCode).toBe(401);
    expect(problemOf(none)).toMatchObject({ type: "urn:ope:problem:unauthorized" });
    const ingest = await putCatalog(app.app, { not: "a snapshot" }, { platformKey: "key-a-1" });
    expect(ingest.statusCode).toBe(401);
  });

  it("the observed level rises to 2 after three receipts five minutes apart", async () => {
    const clock = { at: new Date(NOW), now: (): Date => clock.at };
    app = await startTestApp({ ports: { clock } });
    let last;
    for (let i = 0; i < 3; i += 1) {
      clock.at = new Date(new Date(NOW).getTime() + i * 5 * 60_000);
      last = await putCatalog(app.app, catalogOf(1, clock.at.toISOString()), { platformKey: PLATFORM_A });
    }
    expect(last && (json(last) as Summary).observedSyncLevel).toBe(2);
  });
});
