// Feature 004, US2 and US3 (FR-011..FR-016, FR-020, FR-021; ADR-014): POST /v1/events end to end.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { replace } from "../../src/composition/graph/index.js";
import { DecisionLedgerPort } from "../../src/composition/modules/ledger.js";
import { ClockPort } from "../../src/composition/modules/shared-kernel.js";
import { asDecisionId } from "../../src/domain/ledger/index.js";
import { asMerchantId, asSessionId } from "../../src/domain/shared-kernel/index.js";
import { json, problemOf } from "../helpers/json.js";
import {
  batchOf,
  eventOf,
  fixedClock,
  postEvents,
  sharedTestApp,
  type SharedApp,
} from "../helpers/test-app.js";
import type { components } from "#generated/api.js";

type IngestResult = components["schemas"]["IngestResult"];

const NOW = "2026-09-16T12:00:00.000Z";
// One server per file (015 F-055): the in-memory ports are rebuilt before each test.
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
const at = (offsetMs: number) => new Date(Date.parse(NOW) + offsetMs).toISOString();

/** One event of each type of 03 §4.1, with its own attributes. */
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
  it("batch of 20 valid events (one of each type) → 202 with a result per event and a NO_OP decision", async () => {
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

  it("duplicate event: resending the same batch → all `duplicate`; no event is recorded twice, and the resend gets a decision of its own", async () => {
    await postEvents(app.app, batchOf(3, 1, { occurredAt: NOW }), { key: "key-a-1" });
    const res = await postEvents(app.app, batchOf(3, 1, { occurredAt: NOW }), { key: "key-a-1" });
    expect(res.statusCode).toBe(202);
    const body = json(res) as IngestResult;
    expect(body).toMatchObject({ accepted: 0, duplicates: 3 });
    expect(body.results.map((r) => r.status)).toEqual(["duplicate", "duplicate", "duplicate"]);
    // What the ledger keeps: the events enter once, but every batch — this resend too — is decided
    // and its decision recorded (the deduplication is of events, not of decisions; a fact for the
    // persistence feature, F-024 of the audit 014).
    const decisions = await app
      .resolve(DecisionLedgerPort)
      .bySession(asMerchantId("m_a"), asSessionId("ses_00000001"));
    expect(decisions).toHaveLength(2);
    expect(new Set(decisions.map((d) => d.decisionId)).size).toBe(2);
  });

  it("a batch with one new and one repeated event reports each with its status", async () => {
    await postEvents(app.app, batchOf(1, 1, { occurredAt: NOW }), { key: "key-a-1" });
    const res = await postEvents(app.app, batchOf(2, 1, { occurredAt: NOW }), { key: "key-a-1" });
    const body = json(res) as IngestResult;
    expect(body).toMatchObject({ accepted: 1, duplicates: 1 });
    expect(body.results).toEqual([
      { eventId: "evt_00000001", status: "duplicate" },
      { eventId: "evt_00000002", status: "accepted" },
    ]);
  });

  it("the same eventId twice inside one batch counts once: accepted, then duplicate", async () => {
    const twice = { events: [eventOf(1, { occurredAt: NOW }), eventOf(1, { occurredAt: NOW })] };
    const body = json(await postEvents(app.app, twice, { key: "key-a-1" })) as IngestResult;
    expect(body).toMatchObject({ accepted: 1, duplicates: 1 });
    expect(body.results.map((r) => r.status)).toEqual(["accepted", "duplicate"]);
  });

  it("the same eventId in another merchant is another event (isolation FR-050)", async () => {
    await postEvents(app.app, batchOf(3, 1, { occurredAt: NOW }), { key: "key-a-1" });
    const res = await postEvents(app.app, batchOf(3, 1, { occurredAt: NOW }), { key: "key-b-1" });
    expect(json(res)).toMatchObject({ accepted: 3, duplicates: 0 });
  });

  it("undeclared field in an event → 400 with the exact pointer, and nothing of the batch is recorded", async () => {
    const bad = { events: [eventOf(1, { occurredAt: NOW }), eventOf(2, { occurredAt: NOW, foo: 1 })] };
    const res = await postEvents(app.app, bad, { key: "key-a-1" });
    expect(res.statusCode).toBe(400);
    const problem = problemOf(res);
    expect(problem.type).toBe("urn:ope:problem:validation-failed");
    expect(problem.errors?.map((e) => e.pointer)).toContain("/body/events/1/foo");
    // The rejected batch left no trace: the same ids come in as new.
    const again = await postEvents(app.app, batchOf(2, 1, { occurredAt: NOW }), { key: "key-a-1" });
    expect(json(again)).toMatchObject({ accepted: 2, duplicates: 0 });
  });

  it("personal datum in the page context (page.email) → 400 naming the field; it is not scrubbed", async () => {
    const bad = { events: [eventOf(1, { occurredAt: NOW, page: { pageType: "product", email: "a@b.c" } })] };
    const res = await postEvents(app.app, bad, { key: "key-a-1" });
    expect(res.statusCode).toBe(400);
    expect(problemOf(res).errors?.map((e) => e.pointer)).toContain("/body/events/0/page/email");
  });

  it("unknown event type → 400 naming the discriminator", async () => {
    const res = await postEvents(
      app.app,
      { events: [eventOf(1, { occurredAt: NOW, type: "clicked" })] },
      { key: "key-a-1" },
    );
    expect(res.statusCode).toBe(400);
    const errors = problemOf(res).errors ?? [];
    expect(errors.some((e) => e.pointer === "/body/events/0" && e.message.includes('tag "type"'))).toBe(true);
  });

  it("missing own field in its branch (block_dwelled without dwellMs) → precise 400", async () => {
    const res = await postEvents(
      app.app,
      { events: [eventOf(1, { occurredAt: NOW, type: "block_dwelled", block: "price" })] },
      { key: "key-a-1" },
    );
    expect(res.statusCode).toBe(400);
    expect(problemOf(res).errors?.map((e) => e.pointer)).toContain("/body/events/0/dwellMs");
  });

  it("an event that is not an object (array, string, null) → 400, never passes the union", async () => {
    for (const events of [[[null, null]], ["product_viewed"], [null], [42]]) {
      const res = await postEvents(app.app, { events }, { key: "key-a-1" });
      expect(res.statusCode, JSON.stringify(events)).toBe(400);
      expect(problemOf(res).errors?.map((e) => e.pointer)).toContain("/body/events/0");
    }
  });

  it("empty batch or more than 50 events → 400", async () => {
    expect((await postEvents(app.app, { events: [] }, { key: "key-a-1" })).statusCode).toBe(400);
    expect(
      (await postEvents(app.app, batchOf(51, 1, { occurredAt: NOW }), { key: "key-a-1" })).statusCode,
    ).toBe(400);
  });

  it("a body past the browser limit (1 MiB) → 413 payload-too-large before it is parsed, for the public credential (F-057)", async () => {
    const oneMiB = 1024 * 1024;
    const filler = "x".repeat(oneMiB + 1);
    const res = await postEvents(app.app, `{"events":[],"filler":"${filler}"}`, { key: "key-a-1" });
    expect(res.statusCode).toBe(413);
    expect(problemOf(res)).toMatchObject({
      type: "urn:ope:problem:payload-too-large",
      instance: "/v1/events",
    });
    // The instance is the path: a query string neither changes the operation nor travels in the problem.
    const withQuery = await app.app.inject({
      method: "POST",
      url: "/v1/events?utm=x",
      headers: { "content-type": "application/json", "x-ope-ingest-key": "key-a-1" },
      payload: `{"events":[],"filler":"${filler}"}`,
    });
    expect(withQuery.statusCode).toBe(413);
    expect(problemOf(withQuery).instance).toBe("/v1/events");
    // Exactly the limit is not past it: the body is read (and the contract rejects the stranger field).
    const atTheLimit = `{"events":[],"filler":"${"x".repeat(oneMiB)}"}`;
    const padding = oneMiB - Buffer.byteLength(atTheLimit) + oneMiB;
    const exact = `{"events":[],"filler":"${"x".repeat(padding)}"}`;
    expect(Buffer.byteLength(exact)).toBe(oneMiB);
    expect((await postEvents(app.app, exact, { key: "key-a-1" })).statusCode).toBe(400);
    const declaredButShort = await postEvents(app.app, batchOf(1, 1, { occurredAt: NOW }), {
      key: "key-a-1",
      headers: { "content-length": String(oneMiB + 1) },
    });
    expect(declaredButShort.statusCode).toBe(413);
  });

  it("[invariant:session-visitor-mismatch] two visitors in the batch → 422 with its type", async () => {
    const mixed = {
      events: [eventOf(1, { occurredAt: NOW }), eventOf(2, { occurredAt: NOW, visitorId: "vis_00000002" })],
    };
    const res = await postEvents(app.app, mixed, { key: "key-a-1" });
    expect(res.statusCode).toBe(422);
    expect(problemOf(res)).toMatchObject({ type: "urn:ope:problem:session-visitor-mismatch", status: 422 });
  });

  it("[invariant:event-timestamp-out-of-range] timestamp out of tolerance → 422 with its type", async () => {
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

  it("a batch rejected by an invariant produces no decision and records no events", async () => {
    const mixed = {
      events: [eventOf(1, { occurredAt: NOW }), eventOf(2, { occurredAt: NOW, visitorId: "vis_00000002" })],
    };
    await postEvents(app.app, mixed, { key: "key-a-1" });
    const again = await postEvents(app.app, batchOf(2, 1, { occurredAt: NOW }), { key: "key-a-1" });
    expect(json(again)).toMatchObject({ accepted: 2, duplicates: 0 });
  });

  it("merchantId and key never appear in the response", async () => {
    const res = await postEvents(app.app, batchOf(1, 1, { occurredAt: NOW }), { key: "key-a-1" });
    expect(res.body).not.toMatch(/m_a|key-a-1|merchantId/);
  });
});

describe("inline decision (US3)", () => {
  it("each batch produces a distinct decisionId with the contract pattern and the batch session", async () => {
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

  it("product page without productId → reason page-context-incomplete; a batch without signals → barrier-unclear", async () => {
    const incomplete = { events: [eventOf(1, { occurredAt: NOW, page: { pageType: "product" } })] };
    const r1 = json(await postEvents(app.app, incomplete, { key: "key-a-1" })) as IngestResult;
    expect(r1.decision.reason).toBe("page-context-incomplete");
    const r2 = json(
      await postEvents(app.app, batchOf(1, 2, { occurredAt: NOW }), { key: "key-a-1" }),
    ) as IngestResult;
    expect(r2.decision.reason).toBe("barrier-unclear");
  });

  it("the decision stays in the ledger with merchant, session, visitor, reason and instant; another merchant does not see it", async () => {
    const r = json(
      await postEvents(app.app, batchOf(1, 1, { occurredAt: NOW }), { key: "key-a-1" }),
    ) as IngestResult;
    const id = r.decision.decisionId;
    const found = await app.resolve(DecisionLedgerPort).find(asMerchantId("m_a"), asDecisionId(id));
    expect(found).toMatchObject({
      merchantId: "m_a",
      sessionId: "ses_00000001",
      visitorId: "vis_00000001",
      outcome: "NO_OP",
      reason: "barrier-unclear",
      decidedAt: new Date(NOW),
    });
    expect(await app.resolve(DecisionLedgerPort).find(asMerchantId("m_b"), asDecisionId(id))).toBeUndefined();
  });

  it("the locale of the page (BCP 47) is recorded with the decision; absent, the record has no locale", async () => {
    const localized = {
      events: [
        eventOf(1, { occurredAt: NOW, page: { pageType: "product", productId: "SKU-1", locale: "es-AR" } }),
      ],
    };
    const res = await postEvents(app.app, localized, { key: "key-a-1" });
    expect(res.statusCode).toBe(202);
    const id = (json(res) as IngestResult).decision.decisionId;
    expect(await app.resolve(DecisionLedgerPort).find(asMerchantId("m_a"), asDecisionId(id))).toMatchObject({
      locale: "es-AR",
    });
    const plain = json(
      await postEvents(app.app, batchOf(1, 2, { occurredAt: NOW }), { key: "key-a-1" }),
    ) as IngestResult;
    const found = await app
      .resolve(DecisionLedgerPort)
      .find(asMerchantId("m_a"), asDecisionId(plain.decision.decisionId));
    expect(found).toBeDefined();
    expect(found?.locale).toBeUndefined();
  });

  it("a locale that is not a language tag → 400 validation-failed pointing at the field", async () => {
    const bad = {
      events: [
        eventOf(1, {
          occurredAt: NOW,
          page: { pageType: "product", productId: "SKU-1", locale: "not a tag!" },
        }),
      ],
    };
    const res = await postEvents(app.app, bad, { key: "key-a-1" });
    expect(res.statusCode).toBe(400);
    const problem = problemOf(res);
    expect(problem.type).toBe("urn:ope:problem:validation-failed");
    expect(problem.errors?.map((e) => e.pointer)).toContain("/body/events/0/page/locale");
  });
});
