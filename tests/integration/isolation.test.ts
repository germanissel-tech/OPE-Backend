// Feature 004 — FR-050, SC-005 (constitution V): isolation between merchants, in a single readable suite.
// A and B are the merchants of tests/helpers/test-app.ts; each case names both.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { replace } from "../../src/composition/graph/index.js";
import { ProductTruthPort } from "../../src/composition/modules/catalog.js";
import { SessionStatePort, VisitorStatePort } from "../../src/composition/modules/decision.js";
import { AssignmentLedgerPort } from "../../src/composition/modules/experiment.js";
import { DecisionLedgerPort, ExposureLedgerPort } from "../../src/composition/modules/ledger.js";
import { CorroborationLedgerPort, OrderLedgerPort } from "../../src/composition/modules/outcomes.js";
import { ClockPort } from "../../src/composition/modules/shared-kernel.js";
import { asProductId, asVariantId } from "../../src/domain/catalog/index.js";
import { InterveneDecision, asDecisionId } from "../../src/domain/ledger/index.js";
import {
  asExperimentId,
  asMerchantId,
  asSessionId,
  asVisitorId,
} from "../../src/domain/shared-kernel/index.js";
import { json, problemOf } from "../helpers/json.js";
import {
  admin,
  batchOf,
  catalogOf,
  catalogProductOf,
  eventOf,
  fixedClock,
  merchantB,
  orderOf,
  postCorroboration,
  postEvents,
  postExposure,
  postOrder,
  postReturn,
  putCatalog,
  sharedTestApp,
  type MerchantSpec,
  type SharedApp,
} from "../helpers/test-app.js";
import type { components } from "#generated/api.js";
import type { Assignment } from "../../src/domain/experiment/index.js";
import type { OrderId } from "../../src/domain/outcomes/index.js";

type IngestResult = components["schemas"]["IngestResult"];

const NOW = "2026-09-16T12:00:00.000Z";
const A = { key: "key-a-1", origin: "https://a.example", id: "m_a" };
const B = { key: "key-b-1", origin: "https://b.example", id: "m_b" };

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

const ingest = async (key: string, from = 1) =>
  json(await postEvents(app.app, batchOf(2, from, { occurredAt: NOW }), { key })) as IngestResult;

const exposureOf = (decisionId: string) => ({
  decisionId,
  sessionId: "ses_00000001",
  visitorId: "vis_00000001",
  exposedAt: NOW,
  anchor: "size_selector",
});

async function intervene(merchantId: string, decisionId: string): Promise<void> {
  const decision = InterveneDecision.of(
    {
      decisionId: asDecisionId(decisionId),
      merchantId: asMerchantId(merchantId),
      configuration: { platform: "platform-1", defaults: "defaults-1" },
      sessionId: asSessionId("ses_00000001"),
      visitorId: asVisitorId("vis_00000001"),
      decidedAt: new Date(NOW),
    },
    "barrier-size",
    { messageVersionId: "msg-1", anchor: "size_selector" },
  );
  await app.resolve(DecisionLedgerPort).record(decision);
}

describe("isolation between merchants", () => {
  it("deduplication: the same eventId in A and in B comes in for both", async () => {
    expect(await ingest(A.key)).toMatchObject({ accepted: 2, duplicates: 0 });
    expect(await ingest(B.key)).toMatchObject({ accepted: 2, duplicates: 0 });
    expect(await ingest(A.key)).toMatchObject({ accepted: 0, duplicates: 2 });
  });

  it("decisions: a decision of A does not exist for B (neither through the port nor through HTTP)", async () => {
    const { decision } = await ingest(A.key);
    expect(
      await app.resolve(DecisionLedgerPort).find(asMerchantId(A.id), asDecisionId(decision.decisionId)),
    ).toBeDefined();
    expect(
      await app.resolve(DecisionLedgerPort).find(asMerchantId(B.id), asDecisionId(decision.decisionId)),
    ).toBeUndefined();
    const res = await postExposure(app.app, exposureOf(decision.decisionId), { key: B.key });
    expect(res.statusCode).toBe(422);
    expect(problemOf(res).type).toBe("urn:ope:problem:exposure-decision-unknown");
  });

  it("exposures: A exposes its intervention; B neither sees it nor can expose it", async () => {
    await intervene(A.id, "dec_de_a_00001");
    expect((await postExposure(app.app, exposureOf("dec_de_a_00001"), { key: A.key })).statusCode).toBe(201);
    expect(
      await app.resolve(ExposureLedgerPort).find(asMerchantId(B.id), asDecisionId("dec_de_a_00001")),
    ).toBeUndefined();
    const asB = await postExposure(app.app, exposureOf("dec_de_a_00001"), { key: B.key });
    expect(asB.statusCode).toBe(422);
  });

  it("origins: the key of A with the Origin of B → 403; each with its own origin → passes", async () => {
    const crossed = await postEvents(app.app, batchOf(1, 1, { occurredAt: NOW }), {
      key: A.key,
      origin: B.origin,
    });
    expect(crossed.statusCode).toBe(403);
    expect(problemOf(crossed).type).toBe("urn:ope:problem:origin-not-allowed");
    const ownA = await postEvents(app.app, batchOf(1, 2, { occurredAt: NOW }), {
      key: A.key,
      origin: A.origin,
    });
    const ownB = await postEvents(app.app, batchOf(1, 3, { occurredAt: NOW }), {
      key: B.key,
      origin: B.origin,
    });
    expect([ownA.statusCode, ownB.statusCode]).toEqual([202, 202]);
  });

  it("credentials: the key of B does not resolve to A; no response names the other merchant", async () => {
    const { decision } = await ingest(A.key);
    const res = await postExposure(app.app, exposureOf(decision.decisionId), { key: B.key });
    expect(res.body).not.toMatch(/m_a|key-a/);
  });

  it("assignments: the same visitor in two merchants with active experiments is assigned independently; nothing crosses", async () => {
    const experiment = (seed: string) => ({
      experimentId: "exp_iso_00001",
      treatmentShare: 0.5,
      seed,
      status: "active" as const,
      openedAt: NOW,
    });
    const merchantA: MerchantSpec = {
      merchantId: A.id,
      ingestKeys: [A.key],
      origins: [A.origin],
      experiments: [experiment("seed-a")],
    };
    const merchantC: MerchantSpec = {
      merchantId: "m_c",
      ingestKeys: ["key-c-1"],
      origins: ["https://c.example"],
      experiments: [experiment("seed-c")],
    };
    await app.resetPorts({ config: { merchants: [merchantA, merchantB, merchantC] } });
    // Over many visitors the two merchants must disagree about half of the time (seeds differ).
    let disagree = 0;
    const visitors = 60;
    for (let n = 1; n <= visitors; n += 1) {
      const visitorId = `vis_iso_${String(n).padStart(6, "0")}`;
      await postEvents(app.app, batchOf(1, n, { occurredAt: NOW, visitorId }), { key: A.key });
      await postEvents(app.app, batchOf(1, n, { occurredAt: NOW, visitorId }), { key: "key-c-1" });
      const inA = await app
        .resolve(AssignmentLedgerPort)
        .find(asMerchantId(A.id), asExperimentId("exp_iso_00001"), asVisitorId(visitorId));
      const inC = await app
        .resolve(AssignmentLedgerPort)
        .find(asMerchantId("m_c"), asExperimentId("exp_iso_00001"), asVisitorId(visitorId));
      expect(inA?.merchantId).toBe(A.id);
      expect(inC?.merchantId).toBe("m_c");
      if (inA?.arm !== inC?.arm) disagree += 1;
      expect(
        await app
          .resolve(AssignmentLedgerPort)
          .find(asMerchantId(B.id), asExperimentId("exp_iso_00001"), asVisitorId(visitorId)),
      ).toBeUndefined();
    }
    expect(disagree).toBeGreaterThan(visitors * 0.2);
    expect(disagree).toBeLessThan(visitors * 0.8);
  });

  it("experiments: a closed and an active experiment of the same merchant do not share assignments", async () => {
    const closed = {
      experimentId: "exp_closed_001",
      treatmentShare: 0.5,
      seed: "old",
      status: "closed" as const,
      openedAt: NOW,
    };
    const active = {
      experimentId: "exp_active_01",
      treatmentShare: 0.5,
      seed: "new",
      status: "active" as const,
      openedAt: NOW,
    };
    const merchantA: MerchantSpec = {
      merchantId: A.id,
      ingestKeys: [A.key],
      origins: [A.origin],
      experiments: [closed, active],
    };
    await app.resetPorts({ config: { merchants: [merchantA, merchantB] } });
    const stale: Assignment = {
      merchantId: A.id as Assignment["merchantId"],
      experimentId: "exp_closed_001" as Assignment["experimentId"],
      visitorId: "vis_00000001" as Assignment["visitorId"],
      arm: "TREATMENT",
      assignedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    await app.resolve(AssignmentLedgerPort).record(stale);
    await ingest(A.key);
    expect(
      await app
        .resolve(AssignmentLedgerPort)
        .find(asMerchantId(A.id), asExperimentId("exp_closed_001"), asVisitorId("vis_00000001")),
    ).toEqual(stale);
    const fresh = await app
      .resolve(AssignmentLedgerPort)
      .find(asMerchantId(A.id), asExperimentId("exp_active_01"), asVisitorId("vis_00000001"));
    expect(fresh).toMatchObject({ experimentId: "exp_active_01", assignedAt: new Date(NOW) });
  });

  it("decision policy: A (threshold 0.9) and B (threshold 0.4) decide differently on the same session; each ledger stamps its own version", async () => {
    const policy = (version: string, threshold: number): Record<string, unknown> => ({
      version,
      threshold,
      priority: ["returns", "fit", "price"],
      evidence: { freshStockAndPrice: ["price"], availableVariant: ["fit"] },
      rules: [
        {
          id: "fit.size-guide",
          barrier: "fit",
          strength: "strong",
          when: { fact: "dwellSeconds", block: "size_guide" },
        },
        {
          id: "price.price",
          barrier: "price",
          strength: "strong",
          when: { fact: "dwellSeconds", block: "price" },
        },
        {
          id: "returns.policies",
          barrier: "returns",
          strength: "strong",
          when: { fact: "dwellSeconds", block: "policies" },
        },
      ],
    });
    const experiment = {
      experimentId: "exp_iso_00001",
      treatmentShare: 1,
      seed: "s",
      status: "active" as const,
      openedAt: NOW,
    };
    const a: MerchantSpec = {
      merchantId: A.id,
      ingestKeys: [A.key],
      platformKeys: ["platform-a-1"],
      origins: [A.origin],
      experiments: [experiment],
      decisionPolicy: policy("a-1", 0.9),
    };
    const b: MerchantSpec = {
      merchantId: B.id,
      ingestKeys: [B.key],
      platformKeys: ["platform-b-1"],
      origins: [B.origin],
      experiments: [experiment],
      decisionPolicy: policy("b-1", 0.4),
    };
    await app.resetPorts({ config: { merchants: [a, b] } });
    for (const key of ["platform-a-1", "platform-b-1"]) {
      expect(
        (
          await putCatalog(
            app.app,
            { capturedAt: NOW, products: [catalogProductOf("SKU-1")] },
            { platformKey: key },
          )
        ).statusCode,
      ).toBe(201);
    }
    const page = { pageType: "product", productId: "SKU-1", variantId: "SKU-1-M" };
    const batch = (from: number) => ({
      events: [
        eventOf(from, { occurredAt: NOW, page, type: "block_dwelled", block: "size_guide", dwellMs: 6000 }),
      ],
    });
    const inA = json(await postEvents(app.app, batch(1), { key: A.key })) as IngestResult;
    const inB = json(await postEvents(app.app, batch(1), { key: B.key })) as IngestResult;
    expect(inA.decision).toMatchObject({ outcome: "NO_OP", reason: "barrier-unclear" });
    expect(inB.decision).toMatchObject({ outcome: "INTERVENE", reason: "fit" });
    const ledgerA = await app
      .resolve(DecisionLedgerPort)
      .find(asMerchantId(A.id), asDecisionId(inA.decision.decisionId));
    const ledgerB = await app
      .resolve(DecisionLedgerPort)
      .find(asMerchantId(B.id), asDecisionId(inB.decision.decisionId));
    expect(ledgerA?.inference?.policyVersion).toBe("a-1");
    expect(ledgerB?.inference?.policyVersion).toBe("b-1");
    // The same sessionId in A and B: B's intervention does not exhaust A's budget nor lend it signals.
    const again = json(await postEvents(app.app, batch(2), { key: A.key })) as IngestResult;
    expect(again.decision.reason).toBe("barrier-unclear");
    expect(
      await app.resolve(SessionStatePort).load(asMerchantId(A.id), asSessionId("ses_00000001")),
    ).toMatchObject({
      interventions: 0,
    });
    expect(
      await app.resolve(SessionStatePort).load(asMerchantId(B.id), asSessionId("ses_00000001")),
    ).toMatchObject({
      interventions: 1,
    });
    expect(
      await app.resolve(SessionStatePort).load(asMerchantId("m_c"), asSessionId("ses_00000001")),
    ).toBeUndefined();
  });

  it("commercial policy and visitor state: A with margin grants the incentive, B without margin does not; A's fatigue does not touch B", async () => {
    const experiment = {
      experimentId: "exp_iso_00002",
      treatmentShare: 1,
      seed: "s",
      status: "active" as const,
      openedAt: NOW,
    };
    const profile = { returnsPolicy: true, fitData: true };
    const a: MerchantSpec = {
      merchantId: A.id,
      ingestKeys: [A.key],
      platformKeys: ["platform-a-1"],
      origins: [A.origin],
      experiments: [experiment],
      evidenceProfile: profile,
      commercialPolicy: { version: "a-c", marginShare: 0.4, interventionsPerVisitorPerDay: 1 },
    };
    const b: MerchantSpec = {
      merchantId: B.id,
      ingestKeys: [B.key],
      platformKeys: ["platform-b-1"],
      origins: [B.origin],
      experiments: [experiment],
      evidenceProfile: profile,
      commercialPolicy: { version: "b-c" },
    };
    await app.resetPorts({ config: { merchants: [a, b] } });
    for (const key of ["platform-a-1", "platform-b-1"]) {
      const res = await putCatalog(
        app.app,
        { capturedAt: NOW, products: [catalogProductOf("SKU-1")] },
        { platformKey: key },
      );
      expect(res.statusCode).toBe(201);
    }
    const page = { pageType: "product", productId: "SKU-1", variantId: "SKU-1-M" };
    const price = (from: number, sessionId: string) => ({
      events: [
        eventOf(from, {
          occurredAt: NOW,
          page,
          sessionId,
          type: "block_dwelled",
          block: "price",
          dwellMs: 6000,
        }),
        eventOf(from + 1, { occurredAt: NOW, page, sessionId, type: "cta_approached", approach: "hover" }),
      ],
    });
    const inA = json(await postEvents(app.app, price(1, "ses_00000001"), { key: A.key })) as IngestResult;
    const inB = json(await postEvents(app.app, price(1, "ses_00000001"), { key: B.key })) as IngestResult;
    expect(inA.decision.intervention).toMatchObject({ incentive: { kind: "percent", value: 0.05 } });
    expect(inB.decision.intervention?.messageVersionId).toBe("msg_price_price_information_v0");
    expect(inB.decision.intervention).not.toHaveProperty("incentive");
    const ledgerA = await app
      .resolve(DecisionLedgerPort)
      .find(asMerchantId(A.id), asDecisionId(inA.decision.decisionId));
    const ledgerB = await app
      .resolve(DecisionLedgerPort)
      .find(asMerchantId(B.id), asDecisionId(inB.decision.decisionId));
    expect(ledgerA?.selection?.commercialPolicyVersion).toBe("a-c");
    expect(ledgerB?.selection?.commercialPolicyVersion).toBe("b-c");
    // The same visitor is fatigued in A (one per day) but not in B, and B's visitor state is its own.
    const againA = json(await postEvents(app.app, price(10, "ses_00000002"), { key: A.key })) as IngestResult;
    expect(againA.decision).toMatchObject({ outcome: "NO_OP", reason: "visitor-fatigue" });
    const againB = json(await postEvents(app.app, price(10, "ses_00000002"), { key: B.key })) as IngestResult;
    expect(againB.decision.outcome).toBe("INTERVENE");
    expect(
      await app.resolve(VisitorStatePort).load(asMerchantId(A.id), asVisitorId("vis_00000001")),
    ).toMatchObject({
      interventions: [new Date(NOW)],
    });
    expect(
      await app.resolve(VisitorStatePort).load(asMerchantId("m_c"), asVisitorId("vis_00000001")),
    ).toBeUndefined();
  });

  it("catalogue: the snapshot of A is invisible to B; the same productId in A and B are two products; B's platform key cannot touch A", async () => {
    const a = await putCatalog(
      app.app,
      { capturedAt: NOW, products: [catalogProductOf("SKU-1", 1, { title: "A's shirt" })] },
      { platformKey: "platform-a-1" },
    );
    const b = await putCatalog(
      app.app,
      { capturedAt: NOW, products: [catalogProductOf("SKU-1", 1, { title: "B's shirt" })] },
      { platformKey: "platform-b-1" },
    );
    expect([a.statusCode, b.statusCode]).toEqual([201, 201]);
    const truth = app.resolve(ProductTruthPort);
    const inA = await truth.lookup(asMerchantId(A.id), asProductId("SKU-1"), asVariantId("SKU-1-M"));
    const inB = await truth.lookup(asMerchantId(B.id), asProductId("SKU-1"), asVariantId("SKU-1-M"));
    expect(inA).toMatchObject({ kind: "known", product: { title: "A's shirt" } });
    expect(inB).toMatchObject({ kind: "known", product: { title: "B's shirt" } });
    expect(await truth.lookup(asMerchantId("m_c"), asProductId("SKU-1"), asVariantId("SKU-1-M"))).toEqual({
      kind: "unknown",
      reason: "absent",
    });
    // B replaces its own catalogue; A's stays.
    const later = new Date(new Date(NOW).getTime() + 60_000).toISOString();
    expect((await putCatalog(app.app, catalogOf(0, later), { platformKey: "platform-b-1" })).statusCode).toBe(
      201,
    );
    expect(
      await truth.lookup(asMerchantId(A.id), asProductId("SKU-1"), asVariantId("SKU-1-M")),
    ).toMatchObject({ kind: "known" });
    expect(
      await truth.lookup(asMerchantId(B.id), asProductId("SKU-1"), asVariantId("SKU-1-M")),
    ).toMatchObject({ kind: "unknown" });
  });

  it("outcomes: an order of A with a session of B is not attributed; the same orderId in A and B are two orders; corroborations and returns do not cross (FR-073)", async () => {
    // B decides in ses_00000001 (no experiment: a NO_OP, still a known session for B).
    const bBatch = await postEvents(app.app, batchOf(1, 1, { occurredAt: NOW }), { key: B.key });
    expect(bBatch.statusCode).toBe(202);
    const inA = await postOrder(app.app, orderOf("X-1", { sessionId: "ses_00000001", confirmedAt: NOW }), {
      platformKey: "platform-a-1",
    });
    expect(json(inA)).toMatchObject({ status: "VERIFIED_ORDER", correlation: "PENDING_CORRELATION" });
    const inB = await postOrder(app.app, orderOf("X-1", { sessionId: "ses_00000001", confirmedAt: NOW }), {
      platformKey: "platform-b-1",
    });
    expect(json(inB)).toMatchObject({ status: "ATTRIBUTED_ORDER", correlation: "ATTRIBUTED" });
    const orderId = "X-1" as OrderId;
    expect((await app.resolve(OrderLedgerPort).find(asMerchantId(A.id), orderId))?.status()).toBe(
      "VERIFIED_ORDER",
    );
    expect((await app.resolve(OrderLedgerPort).find(asMerchantId(B.id), orderId))?.status()).toBe(
      "ATTRIBUTED_ORDER",
    );
    // A's corroboration of X-1 lives under A only.
    await postCorroboration(
      app.app,
      { orderId: "X-1", sessionId: "ses_00000001", visitorId: "vis_00000001", confirmedAt: NOW },
      { key: A.key },
    );
    expect(await app.resolve(CorroborationLedgerPort).find(asMerchantId(A.id), orderId)).toHaveLength(1);
    expect(await app.resolve(CorroborationLedgerPort).find(asMerchantId(B.id), orderId)).toHaveLength(0);
    // B returns its X-1; A's X-1 is untouched. A returning "Y-1" that only B has → unknown.
    expect(
      (await postReturn(app.app, { orderId: "X-1", returnedAt: NOW }, { platformKey: "platform-b-1" }))
        .statusCode,
    ).toBe(201);
    expect((await app.resolve(OrderLedgerPort).find(asMerchantId(A.id), orderId))?.returned).toBeUndefined();
    await postOrder(app.app, orderOf("Y-1", { confirmedAt: NOW }), { platformKey: "platform-b-1" });
    const foreign = await postReturn(
      app.app,
      { orderId: "Y-1", returnedAt: NOW },
      { platformKey: "platform-a-1" },
    );
    expect(foreign.statusCode).toBe(422);
    expect(json(foreign)).toMatchObject({ type: "urn:ope:problem:order-unknown" });
  });

  it("administration (feature 017, FR-025): an operator scoped to A neither reads, switches nor rotates B; A's log never carries B; the kill switch of A leaves B deciding", async () => {
    const asA = { as: "ops-a" as const };
    expect((await admin(app.app, "GET", "/v1/admin/merchants/m_b", asA)).statusCode).toBe(403);
    expect(
      (
        await admin(app.app, "PUT", "/v1/admin/merchants/m_b/kill-switch", {
          ...asA,
          body: { enabled: false },
        })
      ).statusCode,
    ).toBe(403);
    expect((await admin(app.app, "POST", "/v1/admin/merchants/m_b/ingest-keys", asA)).statusCode).toBe(403);
    expect((await admin(app.app, "POST", "/v1/admin/merchants/m_b/deactivate", asA)).statusCode).toBe(403);
    expect((await admin(app.app, "GET", "/v1/admin/merchants/m_b/log", asA)).statusCode).toBe(403);
    expect(
      (
        await admin(app.app, "PUT", "/v1/admin/merchants/m_a/kill-switch", {
          ...asA,
          body: { enabled: false },
        })
      ).statusCode,
    ).toBe(200);
    const inB = await postEvents(app.app, batchOf(1, 1, { occurredAt: NOW }), { key: "key-b-1" });
    expect((json(inB) as { decision: { reason: string } }).decision.reason).not.toBe("merchant-off");
    const inA = await postEvents(app.app, batchOf(1, 2, { occurredAt: NOW }), { key: "key-a-1" });
    expect((json(inA) as { decision: { reason: string } }).decision.reason).toBe("merchant-off");
    const logA = json(await admin(app.app, "GET", "/v1/admin/merchants/m_a/log")) as {
      items: { merchantId?: string }[];
    };
    expect(logA.items.every((e) => e.merchantId === "m_a")).toBe(true);
    expect((await admin(app.app, "GET", "/v1/admin/merchants/m_b")).statusCode).toBe(200);
  });
});
