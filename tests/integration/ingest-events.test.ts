// US2 y US3 (FR-011..FR-016, FR-020, FR-021; ADR-014): POST /v1/events de punta a punta.
import { afterEach, describe, expect, it } from "vitest";
import { json, problemOf } from "../helpers/json.js";
import { batchOf, eventOf, fixedClock, postEvents, startTestApp } from "../helpers/test-app.js";
import type { App } from "../../src/composition/bootstrap.js";
import type { components } from "../../src/interface-adapters/http/client.js";

type IngestResult = components["schemas"]["IngestResult"];

let app: App | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

const NOW = "2026-09-16T12:00:00.000Z";
const withClock = () => startTestApp({ ports: { clock: fixedClock(NOW) } });
const at = (offsetMs: number) => new Date(Date.parse(NOW) + offsetMs).toISOString();

/** Un evento de cada tipo de 03 §4.1, con sus atributos propios. */
const ONE_OF_EACH: Record<string, unknown>[] = [
  { type: "product_viewed" },
  { type: "listing_viewed", page: { pageType: "listing" } },
  { type: "size_selector_interacted", size: "M" },
  { type: "variant_selected", selectedVariantId: "VAR-1" },
  { type: "photo_interacted", interaction: "zoom" },
  { type: "block_dwelled", block: "size_guide", dwellMs: 4200 },
  { type: "cta_approached", approach: "hover" },
  { type: "product_returned_to", previousProductId: "SKU-0" },
  { type: "added_to_cart", quantity: 1 },
  { type: "removed_from_cart", page: { pageType: "cart" } },
  { type: "checkout_advanced", step: "shipping", page: { pageType: "checkout" } },
  { type: "exit_signaled", signal: "tab_hidden" },
];

function batchOfEach(from = 1): { events: unknown[] } {
  const twenty = [...ONE_OF_EACH, ...ONE_OF_EACH.slice(0, 8)];
  return { events: twenty.map((over, i) => eventOf(from + i, { occurredAt: NOW, ...over })) };
}

describe("POST /v1/events", () => {
  it("lote de 20 eventos válidos (uno de cada tipo) → 202 con resultado por evento y decisión NO_OP", async () => {
    app = await withClock();
    const res = await postEvents(app.app, batchOfEach(), { key: "key-a-1" });
    expect(res.statusCode, res.body).toBe(202);
    const body = json(res) as IngestResult;
    expect(body.accepted).toBe(20);
    expect(body.duplicates).toBe(0);
    expect(body.results.map((r) => r.eventId)).toEqual(
      Array.from({ length: 20 }, (_, i) => `evt_${String(i + 1).padStart(8, "0")}`),
    );
    expect(body.results.every((r) => r.status === "accepted")).toBe(true);
    expect(body.decision.outcome).toBe("NO_OP");
    expect(body.decision.reason).toMatch(/^[a-z][a-z0-9-]*$/);
    expect(body.decision.sessionId).toBe("ses_00000001");
  });

  it("evento duplicado: reenviar el mismo lote → todos `duplicate`, nada se registra dos veces (idempotencia)", async () => {
    app = await withClock();
    await postEvents(app.app, batchOf(3, 1, { occurredAt: NOW }), { key: "key-a-1" });
    const res = await postEvents(app.app, batchOf(3, 1, { occurredAt: NOW }), { key: "key-a-1" });
    expect(res.statusCode).toBe(202);
    const body = json(res) as IngestResult;
    expect(body).toMatchObject({ accepted: 0, duplicates: 3 });
    expect(body.results.map((r) => r.status)).toEqual(["duplicate", "duplicate", "duplicate"]);
  });

  it("un lote con un evento nuevo y uno repetido reporta cada uno con su estado", async () => {
    app = await withClock();
    await postEvents(app.app, batchOf(1, 1, { occurredAt: NOW }), { key: "key-a-1" });
    const res = await postEvents(app.app, batchOf(2, 1, { occurredAt: NOW }), { key: "key-a-1" });
    const body = json(res) as IngestResult;
    expect(body).toMatchObject({ accepted: 1, duplicates: 1 });
    expect(body.results).toEqual([
      { eventId: "evt_00000001", status: "duplicate" },
      { eventId: "evt_00000002", status: "accepted" },
    ]);
  });

  it("el mismo eventId en otro merchant es otro evento (aislamiento FR-050)", async () => {
    app = await withClock();
    await postEvents(app.app, batchOf(3, 1, { occurredAt: NOW }), { key: "key-a-1" });
    const res = await postEvents(app.app, batchOf(3, 1, { occurredAt: NOW }), { key: "key-b-1" });
    expect(json(res)).toMatchObject({ accepted: 3, duplicates: 0 });
  });

  it("campo no declarado en un evento → 400 con el puntero exacto, y nada del lote se registra", async () => {
    app = await withClock();
    const bad = { events: [eventOf(1, { occurredAt: NOW }), eventOf(2, { occurredAt: NOW, foo: 1 })] };
    const res = await postEvents(app.app, bad, { key: "key-a-1" });
    expect(res.statusCode).toBe(400);
    const problem = problemOf(res);
    expect(problem.type).toBe("urn:ope:problem:validation-failed");
    expect(problem.errors?.map((e) => e.pointer)).toContain("/body/events/1/foo");
    // El lote rechazado no dejó rastro: los mismos ids entran como nuevos.
    const again = await postEvents(app.app, batchOf(2, 1, { occurredAt: NOW }), { key: "key-a-1" });
    expect(json(again)).toMatchObject({ accepted: 2, duplicates: 0 });
  });

  it("dato personal en el contexto de página (page.email) → 400 nombrando el campo; no se limpia", async () => {
    app = await withClock();
    const bad = { events: [eventOf(1, { occurredAt: NOW, page: { pageType: "product", email: "a@b.c" } })] };
    const res = await postEvents(app.app, bad, { key: "key-a-1" });
    expect(res.statusCode).toBe(400);
    expect(problemOf(res).errors?.map((e) => e.pointer)).toContain("/body/events/0/page/email");
  });

  it("tipo de evento desconocido → 400 que nombra el discriminador", async () => {
    app = await withClock();
    const res = await postEvents(
      app.app,
      { events: [eventOf(1, { occurredAt: NOW, type: "clicked" })] },
      { key: "key-a-1" },
    );
    expect(res.statusCode).toBe(400);
    const errors = problemOf(res).errors ?? [];
    expect(errors.some((e) => e.pointer === "/body/events/0" && e.message.includes('tag "type"'))).toBe(true);
  });

  it("campo propio faltante en su rama (block_dwelled sin dwellMs) → 400 preciso", async () => {
    app = await withClock();
    const res = await postEvents(
      app.app,
      { events: [eventOf(1, { occurredAt: NOW, type: "block_dwelled", block: "price" })] },
      { key: "key-a-1" },
    );
    expect(res.statusCode).toBe(400);
    expect(problemOf(res).errors?.map((e) => e.pointer)).toContain("/body/events/0/dwellMs");
  });

  it("un evento que no es un objeto (arreglo, string, null) → 400, nunca pasa la unión", async () => {
    app = await withClock();
    for (const events of [[[null, null]], ["product_viewed"], [null], [42]]) {
      const res = await postEvents(app.app, { events }, { key: "key-a-1" });
      expect(res.statusCode, JSON.stringify(events)).toBe(400);
      expect(problemOf(res).errors?.map((e) => e.pointer)).toContain("/body/events/0");
    }
  });

  it("lote vacío o de más de 50 eventos → 400", async () => {
    app = await withClock();
    expect((await postEvents(app.app, { events: [] }, { key: "key-a-1" })).statusCode).toBe(400);
    expect(
      (await postEvents(app.app, batchOf(51, 1, { occurredAt: NOW }), { key: "key-a-1" })).statusCode,
    ).toBe(400);
  });

  it("[invariant:session-visitor-mismatch] dos visitantes en el lote → 422 con su tipo", async () => {
    app = await withClock();
    const mixed = {
      events: [eventOf(1, { occurredAt: NOW }), eventOf(2, { occurredAt: NOW, visitorId: "vis_00000002" })],
    };
    const res = await postEvents(app.app, mixed, { key: "key-a-1" });
    expect(res.statusCode).toBe(422);
    expect(problemOf(res)).toMatchObject({ type: "urn:ope:problem:session-visitor-mismatch", status: 422 });
  });

  it("[invariant:event-timestamp-out-of-range] instante fuera de tolerancia → 422 con su tipo", async () => {
    app = await withClock();
    const res = await postEvents(
      app.app,
      { events: [eventOf(1, { occurredAt: at(6 * 60_000) })] },
      { key: "key-a-1" },
    );
    expect(res.statusCode).toBe(422);
    expect(problemOf(res)).toMatchObject({
      type: "urn:ope:problem:event-timestamp-out-of-range",
      status: 422,
    });
  });

  it("un lote rechazado por invariante no produce decisión ni registra eventos", async () => {
    app = await withClock();
    const mixed = {
      events: [eventOf(1, { occurredAt: NOW }), eventOf(2, { occurredAt: NOW, visitorId: "vis_00000002" })],
    };
    await postEvents(app.app, mixed, { key: "key-a-1" });
    const again = await postEvents(app.app, batchOf(2, 1, { occurredAt: NOW }), { key: "key-a-1" });
    expect(json(again)).toMatchObject({ accepted: 2, duplicates: 0 });
  });

  it("merchantId y clave nunca aparecen en la respuesta", async () => {
    app = await withClock();
    const res = await postEvents(app.app, batchOf(1, 1, { occurredAt: NOW }), { key: "key-a-1" });
    expect(res.body).not.toMatch(/m_a|key-a-1|merchantId/);
  });
});

describe("decisión inline (US3)", () => {
  it("cada lote produce un decisionId distinto con el patrón del contrato y la sesión del lote", async () => {
    app = await withClock();
    const r1 = json(
      await postEvents(app.app, batchOf(1, 1, { occurredAt: NOW }), { key: "key-a-1" }),
    ) as IngestResult;
    const r2 = json(
      await postEvents(app.app, batchOf(1, 2, { occurredAt: NOW }), { key: "key-a-1" }),
    ) as IngestResult;
    expect(r1.decision.decisionId).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(r1.decision.decisionId).not.toBe(r2.decision.decisionId);
    expect(r1.decision.sessionId).toBe("ses_00000001");
  });

  it("ficha de producto sin productId → reason page-context-incomplete; lote normal → decision-plane-unavailable", async () => {
    app = await withClock();
    const incomplete = { events: [eventOf(1, { occurredAt: NOW, page: { pageType: "product" } })] };
    const r1 = json(await postEvents(app.app, incomplete, { key: "key-a-1" })) as IngestResult;
    expect(r1.decision.reason).toBe("page-context-incomplete");
    const r2 = json(
      await postEvents(app.app, batchOf(1, 2, { occurredAt: NOW }), { key: "key-a-1" }),
    ) as IngestResult;
    expect(r2.decision.reason).toBe("decision-plane-unavailable");
  });

  it("la decisión queda en el ledger con merchant, sesión, visitante, motivo e instante; otro merchant no la ve", async () => {
    app = await withClock();
    const r = json(
      await postEvents(app.app, batchOf(1, 1, { occurredAt: NOW }), { key: "key-a-1" }),
    ) as IngestResult;
    const id = r.decision.decisionId;
    const found = await app.ports.decisions.find("m_a" as never, id as never);
    expect(found).toMatchObject({
      merchantId: "m_a",
      sessionId: "ses_00000001",
      visitorId: "vis_00000001",
      outcome: "NO_OP",
      reason: "decision-plane-unavailable",
      decidedAt: new Date(NOW),
    });
    expect(await app.ports.decisions.find("m_b" as never, id as never)).toBeUndefined();
  });

  it("en modo mock la respuesta trae la decisión del ejemplo del contrato", async () => {
    app = await startTestApp({}, { mode: "mock" });
    const res = await postEvents(app.app, batchOf(1, 1, { occurredAt: NOW }), { key: "key-a-1" });
    expect(res.statusCode).toBe(202);
    expect(json(res)).toMatchObject({ decision: { outcome: "NO_OP" } });
  });
});
