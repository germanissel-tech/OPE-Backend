// Feature 011, user stories 1 and 4 (FR-001..FR-003, FR-040, FR-041; SC-001, SC-004): the
// decision plane through HTTP — the first INTERVENE, the reasons of the policy, what the SDK
// sees and what the ledger keeps, and the evidence chain up to the exposure.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { replace } from "../../src/composition/graph/index.js";
import { AssignmentLedgerPort } from "../../src/composition/modules/experiment.js";
import { DecisionLedgerPort, ExposureLedgerPort } from "../../src/composition/modules/ledger.js";
import { ClockPort } from "../../src/composition/modules/shared-kernel.js";
import { asDecisionId } from "../../src/domain/ledger/index.js";
import { asExperimentId, asMerchantId, asVisitorId } from "../../src/domain/shared-kernel/index.js";
import { json } from "../helpers/json.js";
import {
  catalogProductOf,
  eventOf,
  fixedClock,
  postEvents,
  postExposure,
  putCatalog,
  sharedTestApp,
  type MerchantSpec,
  type SharedApp,
} from "../helpers/test-app.js";
import type { components } from "#generated/api.js";

type IngestResult = components["schemas"]["IngestResult"];

const NOW = "2026-09-18T12:00:00.000Z";
const KEY = "key-a-1";
const PAGE = { pageType: "product", productId: "SKU-1", variantId: "SKU-1-M" };

const merchant = (treatmentPercent: number): MerchantSpec => ({
  merchantId: "m_a",
  ingestKeys: [KEY],
  platformKeys: ["platform-a-1"],
  origins: ["https://a.example"],
  experiments: [
    { experimentId: "exp_a_000001", treatmentPercent, seed: "seed-a", status: "active", openedAt: NOW },
  ],
});
const treatment = merchant(100);
const control = merchant(0);

// One server per file (015 F-055): the in-memory ports are rebuilt before each test.
let app: SharedApp;
beforeAll(async () => {
  app = await sharedTestApp({ ports: [replace(ClockPort, fixedClock(NOW))] }, { merchants: [treatment] });
});
beforeEach(async () => {
  await app.resetPorts();
});
afterAll(async () => {
  await app.close();
});

let n = 0;
const at = (seconds: number): string =>
  new Date(new Date(NOW).getTime() - 60_000 + seconds * 1000).toISOString();
const ev = (seconds: number, over: Record<string, unknown>): Record<string, unknown> =>
  eventOf(++n, { occurredAt: at(seconds), page: PAGE, ...over });
const sizeSelector = (s: number) => ev(s, { type: "size_selector_interacted", size: "M" });
const sizeGuide = (s: number, ms = 6000) =>
  ev(s, { type: "block_dwelled", block: "size_guide", dwellMs: ms });
const policies = (s: number, ms = 8000) => ev(s, { type: "block_dwelled", block: "policies", dwellMs: ms });
const addedToCart = (s: number) => ev(s, { type: "added_to_cart", quantity: 1 });
const removedFromCart = (s: number) => ev(s, { type: "removed_from_cart" });
const checkout = (s: number) => ev(s, { type: "checkout_advanced", step: "checkout_started" });

/** The merchant of the test and its catalogue; the server is the file's. */
async function start(spec: MerchantSpec = treatment): Promise<void> {
  await app.resetPorts({ config: { merchants: [spec] } });
  const res = await putCatalog(
    app.app,
    { capturedAt: NOW, products: [catalogProductOf("SKU-1", 2)] },
    { platformKey: "platform-a-1" },
  );
  expect(res.statusCode).toBe(201);
}

const ingest = async (events: Record<string, unknown>[], session = "ses_00000001"): Promise<IngestResult> => {
  const res = await postEvents(
    app.app,
    { events: events.map((e) => ({ ...e, sessionId: session })) },
    { key: KEY },
  );
  expect(res.statusCode).toBe(202);
  return json(res) as IngestResult;
};

const recorded = (decisionId: string) =>
  app.resolve(DecisionLedgerPort).find(asMerchantId("m_a"), asDecisionId(decisionId));

describe("decision plane — user story 1", () => {
  it("1. two size-selector interactions and the size guide → INTERVENE at the size selector; the ledger keeps the reasoning", async () => {
    await start();
    const body = await ingest([sizeSelector(1), sizeSelector(2), sizeGuide(3)]);
    expect(body.decision).toEqual({
      decisionId: body.decision.decisionId,
      sessionId: "ses_00000001",
      outcome: "INTERVENE",
      reason: "fit",
      intervention: { anchor: "size_selector", messageVersionId: "msg_fit_size_selector_information_v0" },
    });
    const decision = await recorded(body.decision.decisionId);
    expect(decision?.inference).toMatchObject({
      policyVersion: "default-1",
      barrier: "fit",
      confidences: { fit: 0.8, price: 0, returns: 0 },
      matched: ["fit.size-selector-twice", "fit.size-guide-read"],
      trigger: "rules",
      evidence: { truth: "known", stockAndPrice: "fresh", available: true },
    });
  });

  it("the DTO never carries the barrier, the confidence nor the signals (FR-040)", async () => {
    await start();
    const body = await ingest([sizeSelector(1), sizeSelector(2), sizeGuide(3)]);
    expect(Object.keys(body.decision).sort()).toEqual([
      "decisionId",
      "intervention",
      "outcome",
      "reason",
      "sessionId",
    ]);
    expect(JSON.stringify(body)).not.toMatch(/confidence|inference|matched|policyVersion/);
  });

  it("2. one weak signal → NO_OP barrier-unclear; the ledger keeps the confidences below the threshold", async () => {
    await start();
    const body = await ingest([sizeSelector(1)]);
    expect(body.decision).toMatchObject({ outcome: "NO_OP", reason: "barrier-unclear" });
    expect(body.decision).not.toHaveProperty("intervention");
    expect((await recorded(body.decision.decisionId))?.inference).toMatchObject({
      confidences: { fit: 0, price: 0, returns: 0 },
      trigger: "none",
    });
  });

  it("3. added to cart, then the policies → returns at the policies", async () => {
    await start();
    const body = await ingest([addedToCart(1), policies(2)]);
    expect(body.decision).toMatchObject({
      outcome: "INTERVENE",
      reason: "returns",
      intervention: { anchor: "policies", messageVersionId: "msg_returns_policies_information_v0" },
    });
  });

  it("4. cart abandonment without a signal → the returns reassurance", async () => {
    await start();
    const body = await ingest([addedToCart(1), removedFromCart(2)]);
    expect(body.decision).toMatchObject({
      outcome: "INTERVENE",
      reason: "returns",
      intervention: { anchor: "policies" },
    });
    expect((await recorded(body.decision.decisionId))?.inference).toMatchObject({
      trigger: "abandonment",
      barrier: "returns",
    });
  });

  it("5. the checkout → NO_OP high-intent even with strong signals", async () => {
    await start();
    const body = await ingest([sizeSelector(1), sizeSelector(2), sizeGuide(3), checkout(4)]);
    expect(body.decision).toMatchObject({ outcome: "NO_OP", reason: "high-intent" });
  });

  it("6. CONTROL → NO_OP control-arm, with the same inference in the ledger (constitution III)", async () => {
    await start(control);
    const body = await ingest([sizeSelector(1), sizeSelector(2), sizeGuide(3)]);
    expect(body.decision).toMatchObject({ outcome: "NO_OP", reason: "control-arm" });
    const decision = await recorded(body.decision.decisionId);
    expect(decision?.experiment?.arm).toBe("CONTROL");
    expect(decision?.inference).toMatchObject({ barrier: "fit", confidences: { fit: 0.8 } });
  });

  it("7. a tie is broken by priority: returns before fit", async () => {
    await start();
    // fit: size-selector-twice (0.4) + size-guide (0.4) = 0.8; returns: policies-read (0.4) + size-doubt-and-policies (0.4) = 0.8.
    const body = await ingest([sizeSelector(1), sizeSelector(2), sizeGuide(3), policies(4)]);
    expect(body.decision).toMatchObject({ outcome: "INTERVENE", reason: "returns" });
  });

  it("8. one intervention per session: the second batch with strong signals → session-budget-exhausted; another session starts afresh", async () => {
    await start();
    expect((await ingest([sizeSelector(1), sizeSelector(2), sizeGuide(3)])).decision.outcome).toBe(
      "INTERVENE",
    );
    expect((await ingest([sizeGuide(10)])).decision).toMatchObject({
      outcome: "NO_OP",
      reason: "session-budget-exhausted",
    });
    expect(
      (await ingest([sizeSelector(20), sizeSelector(21), sizeGuide(22)], "ses_00000002")).decision.outcome,
    ).toBe("INTERVENE");
  });

  it("the session accumulates across batches: one signal per batch reaches the threshold on the second", async () => {
    await start();
    expect((await ingest([sizeSelector(1), sizeSelector(2)])).decision.reason).toBe("barrier-unclear");
    expect((await ingest([sizeGuide(10)])).decision.outcome).toBe("INTERVENE");
  });

  it("a listing page → page-context-incomplete without inference", async () => {
    await start();
    const body = await ingest([ev(1, { type: "listing_viewed", page: { pageType: "listing" } })]);
    expect(body.decision).toMatchObject({ outcome: "NO_OP", reason: "page-context-incomplete" });
    expect((await recorded(body.decision.decisionId))?.inference).toBeUndefined();
  });
});

describe("decision plane — user story 4, the evidence chain", () => {
  it("INTERVENE → confirmExposure 201, repeated 200; ASSIGNED, DECIDED and EXPOSED in the ledger", async () => {
    await start();
    const body = await ingest([sizeSelector(1), sizeSelector(2), sizeGuide(3)]);
    const exposure = {
      decisionId: body.decision.decisionId,
      sessionId: "ses_00000001",
      visitorId: "vis_00000001",
      exposedAt: NOW,
      anchor: "size_selector",
    };
    const first = await postExposure(app.app, exposure, { key: KEY });
    expect(first.statusCode).toBe(201);
    expect(json(first)).toMatchObject({ status: "recorded" });
    const again = await postExposure(app.app, exposure, { key: KEY });
    expect(again.statusCode).toBe(200);
    expect(json(again)).toMatchObject({ status: "already-recorded" });
    expect(
      await app.resolve(ExposureLedgerPort).find(asMerchantId("m_a"), asDecisionId(body.decision.decisionId)),
    ).toMatchObject({
      decisionId: body.decision.decisionId,
      anchor: "size_selector",
    });
    const assignment = await app
      .resolve(AssignmentLedgerPort)
      .find(asMerchantId("m_a"), asExperimentId("exp_a_000001"), asVisitorId("vis_00000001"));
    expect(assignment?.arm).toBe("TREATMENT");
  });

  it("a NO_OP cannot be exposed: 422 exposure-of-no-op", async () => {
    await start();
    const body = await ingest([sizeSelector(1)]);
    const res = await postExposure(
      app.app,
      {
        decisionId: body.decision.decisionId,
        sessionId: "ses_00000001",
        visitorId: "vis_00000001",
        exposedAt: NOW,
        anchor: "size_selector",
      },
      { key: KEY },
    );
    expect(res.statusCode).toBe(422);
    expect(json(res)).toMatchObject({ type: "urn:ope:problem:exposure-of-no-op" });
  });
});
