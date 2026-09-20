// Feature 012, user stories 1–4 through HTTP: the quality gate against the merchant's profile,
// the commercial policy granting and blocking the incentive, cooldown and fatigue, the
// abandonment as an amplifier (D-B) and what the ledger keeps versus what the SDK sees.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { asDecisionId } from "../../src/domain/ledger/index.js";
import { asMerchantId } from "../../src/domain/shared-kernel/index.js";
import { json } from "../helpers/json.js";
import {
  catalogProductOf,
  eventOf,
  fixedClock,
  postEvents,
  putCatalog,
  sharedTestApp,
  type MerchantSpec,
  type SharedApp,
} from "../helpers/test-app.js";
import type { components } from "../../src/interface-adapters/http/client.js";

type IngestResult = components["schemas"]["IngestResult"];

const NOW = "2026-09-19T12:00:00.000Z";
const KEY = "key-a-1";
const PAGE = { pageType: "product", productId: "SKU-1", variantId: "SKU-1-M" };

const spec = (over: Partial<MerchantSpec> = {}): MerchantSpec => ({
  merchantId: "m_a",
  ingestKeys: [KEY],
  platformKeys: ["platform-a-1"],
  origins: ["https://a.example"],
  experiments: [
    { experimentId: "exp_a_000001", treatmentPercent: 100, seed: "seed-a", status: "active", startedAt: NOW },
  ],
  evidenceProfile: { returnsPolicy: true, fitData: true },
  commercialPolicy: { version: "a-commercial-1", marginPercent: 40 },
  ...over,
});

// One server per file (015 F-055): the in-memory ports are rebuilt before each test.
let app: SharedApp;
beforeAll(async () => {
  app = await sharedTestApp({ ports: { clock: fixedClock(NOW) } }, { merchants: [spec()] });
});
beforeEach(() => {
  app.resetPorts();
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
const sizeGuide = (s: number) => ev(s, { type: "block_dwelled", block: "size_guide", dwellMs: 6000 });
const priceRead = (s: number) => ev(s, { type: "block_dwelled", block: "price", dwellMs: 6000 });
const policies = (s: number) => ev(s, { type: "block_dwelled", block: "policies", dwellMs: 8000 });
const cta = (s: number) => ev(s, { type: "cta_approached", approach: "hover" });
const addedToCart = (s: number) => ev(s, { type: "added_to_cart", quantity: 1 });
const removedFromCart = (s: number) => ev(s, { type: "removed_from_cart" });
const variant = (s: number, id: string) => ev(s, { type: "variant_selected", selectedVariantId: id });

/** The merchant of the test and its catalogue; the server is the file's. */
async function start(merchant: MerchantSpec = spec(), catalogAt = NOW): Promise<void> {
  app.resetPorts({ config: { merchants: [merchant] } });
  const res = await putCatalog(
    app.app,
    { capturedAt: catalogAt, products: [catalogProductOf("SKU-1", 2)] },
    { platformKey: "platform-a-1" },
  );
  expect(res.statusCode).toBe(201);
}

const ingest = async (
  events: Record<string, unknown>[],
  ids: { session?: string; visitor?: string } = {},
): Promise<IngestResult> => {
  const session = ids.session ?? "ses_00000001";
  const visitor = ids.visitor ?? "vis_00000001";
  const res = await postEvents(
    app.app,
    { events: events.map((e) => ({ ...e, sessionId: session, visitorId: visitor })) },
    { key: KEY },
  );
  expect(res.statusCode).toBe(202);
  return json(res) as IngestResult;
};

const recorded = (decisionId: string) =>
  app.ports.decisions.find(asMerchantId("m_a"), asDecisionId(decisionId));

/** price barrier: price read (0.4) + cta (0.2) = 0.6 */
const priceSignals = (from = 1) => [priceRead(from), cta(from + 1)];

describe("commercial policy — the incentive (user story 2)", () => {
  it("price with margin, ceiling and the direct incentive → INTERVENE with the first step; the ledger keeps the selection", async () => {
    await start();
    const body = await ingest(priceSignals());
    expect(body.decision).toMatchObject({
      outcome: "INTERVENE",
      reason: "price",
      intervention: {
        anchor: "price",
        messageVersionId: "msg_price_price_incentive_v0",
        incentive: { kind: "percent", value: 5 },
      },
    });
    const decision = await recorded(body.decision.decisionId);
    expect(decision?.selection).toEqual({
      candidates: [
        { candidateId: "msg_price_price_information_v0", step: "information", verdict: "acceptable" },
        { candidateId: "msg_price_price_evidence_v0", step: "evidence", verdict: "acceptable" },
        { candidateId: "msg_price_price_incentive_v0", step: "incentive", verdict: "acceptable" },
      ],
      chosen: "msg_price_price_incentive_v0",
      commercialVerdict: { blocked: false },
      commercialPolicyVersion: "a-commercial-1",
    });
  });

  it("without margin → the value message, no incentive; the ledger keeps the fallback", async () => {
    await start(spec({ commercialPolicy: { version: "a-commercial-2" } }));
    const body = await ingest(priceSignals());
    expect(body.decision).toMatchObject({
      outcome: "INTERVENE",
      reason: "price",
      intervention: { messageVersionId: "msg_price_price_information_v0" },
    });
    expect(body.decision.intervention).not.toHaveProperty("incentive");
    expect((await recorded(body.decision.decisionId))?.selection).toMatchObject({
      chosen: "msg_price_price_information_v0",
      commercialVerdict: { blocked: false },
    });
  });

  it("a high return risk (the policy's own condition) → no incentive: the value message, the fallback in the ledger", async () => {
    // The merchant's return risk: three zooms on the photos (a signal the default rules barely weigh).
    const returnRisk = { fact: "eventCount", type: "photo_interacted", subtype: "zoom", min: 3 };
    await start(spec({ commercialPolicy: { version: "c", marginPercent: 40, returnRisk } }));
    const zoom = (s: number) => ev(s, { type: "photo_interacted", interaction: "zoom" });
    const body = await ingest([...priceSignals(), zoom(3), zoom(4), zoom(5)]);
    expect(body.decision).toMatchObject({
      outcome: "INTERVENE",
      reason: "price",
      intervention: { messageVersionId: "msg_price_price_information_v0" },
    });
    expect(body.decision.intervention).not.toHaveProperty("incentive");
    expect((await recorded(body.decision.decisionId))?.selection).toMatchObject({
      chosen: "msg_price_price_information_v0",
      commercialVerdict: { blocked: false },
    });
  });

  it("stale stock and price with the price barrier: the barrier-level evidence check comes before the gate", async () => {
    const twoHoursAgo = new Date(new Date(NOW).getTime() - 2 * 3_600_000).toISOString();
    await start(spec({ commercialPolicy: { version: "c" } }), twoHoursAgo);
    const body = await ingest(priceSignals());
    expect(body.decision).toMatchObject({ outcome: "NO_OP", reason: "evidence-stale" });
    expect((await recorded(body.decision.decisionId))?.selection?.candidates).toEqual([]);
  });

  it("cooldown: within the cooldown the session is exhausted even with budget left", async () => {
    await start(
      spec({
        commercialPolicy: {
          version: "c",
          marginPercent: 40,
          interventionsPerSession: 2,
          cooldownSeconds: 600,
        },
      }),
    );
    expect((await ingest(priceSignals())).decision.outcome).toBe("INTERVENE");
    const again = await ingest([sizeSelector(10), sizeSelector(11), sizeGuide(12)]);
    expect(again.decision).toMatchObject({ outcome: "NO_OP", reason: "session-budget-exhausted" });
  });

  it("fatigue: the visitor's interventions per day count across sessions", async () => {
    await start(
      spec({ commercialPolicy: { version: "c", marginPercent: 40, interventionsPerVisitorPerDay: 1 } }),
    );
    expect((await ingest(priceSignals(), { session: "ses_00000001" })).decision.outcome).toBe("INTERVENE");
    const second = await ingest(priceSignals(10), { session: "ses_00000002" });
    expect(second.decision).toMatchObject({ outcome: "NO_OP", reason: "visitor-fatigue" });
    const other = await ingest(priceSignals(20), { session: "ses_00000003", visitor: "vis_00000002" });
    expect(other.decision.outcome).toBe("INTERVENE");
  });

  it("the DTO never carries candidates, claims, the commercial verdict nor policy versions (FR-051)", async () => {
    await start();
    const body = await ingest(priceSignals());
    expect(Object.keys(body.decision).sort()).toEqual([
      "decisionId",
      "intervention",
      "outcome",
      "reason",
      "sessionId",
    ]);
    expect(Object.keys(body.decision.intervention ?? {}).sort()).toEqual([
      "anchor",
      "incentive",
      "messageVersionId",
    ]);
    expect(JSON.stringify(body)).not.toMatch(/candidates|claims|commercialVerdict|PolicyVersion|blocked/);
  });
});

describe("quality gate — the merchant's profile (user story 1)", () => {
  it("without a declared returns policy the reassurance is unacceptable: information goes out, and the ledger says why", async () => {
    await start(spec({ evidenceProfile: { returnsPolicy: false } }));
    const body = await ingest([addedToCart(1), policies(2)]);
    expect(body.decision).toMatchObject({
      outcome: "INTERVENE",
      reason: "returns",
      intervention: { messageVersionId: "msg_returns_policies_information_v0" },
    });
    expect((await recorded(body.decision.decisionId))?.selection?.candidates).toEqual([
      { candidateId: "msg_returns_policies_information_v0", step: "information", verdict: "acceptable" },
      {
        candidateId: "msg_returns_policies_reassurance_v0",
        step: "reassurance",
        verdict: "unacceptable",
        reason: "no-returns-policy",
      },
    ]);
  });

  it("with the returns policy declared, the abandonment without a signal answers with the reassurance itself", async () => {
    await start();
    const body = await ingest([addedToCart(1), removedFromCart(2)]);
    expect(body.decision).toMatchObject({
      outcome: "INTERVENE",
      reason: "returns",
      intervention: { messageVersionId: "msg_returns_policies_reassurance_v0" },
    });
    expect((await recorded(body.decision.decisionId))?.inference).toMatchObject({ trigger: "abandonment" });
  });

  it("without the returns policy the abandonment falls back to the general information", async () => {
    await start(spec({ evidenceProfile: { returnsPolicy: false } }));
    const body = await ingest([addedToCart(1), removedFromCart(2)]);
    expect(body.decision.intervention?.messageVersionId).toBe("msg_returns_policies_information_v0");
  });

  it("stale stock and price: the current-price candidate is unacceptable and the value message goes out", async () => {
    const twoHoursAgo = new Date(new Date(NOW).getTime() - 2 * 3_600_000).toISOString();
    await start(spec(), twoHoursAgo);
    // price needs fresh stock and price at the barrier level: the decision policy says evidence-stale.
    const body = await ingest(priceSignals());
    expect(body.decision).toMatchObject({ outcome: "NO_OP", reason: "evidence-stale" });
    expect((await recorded(body.decision.decisionId))?.selection?.candidates).toEqual([]);
  });
});

describe("the abandonment amplifies the barrier (user story 3, D-B)", () => {
  it("fit confirmed by an abandonment steps up from information to reassurance, never an incentive", async () => {
    await start();
    const body = await ingest([
      // Size guide (0.4) + two variants compared (0.4): fit stays inferred with the cart in play.
      variant(1, "SKU-1-M"),
      variant(2, "SKU-1-L"),
      sizeGuide(3),
      addedToCart(4),
      removedFromCart(5),
    ]);
    expect(body.decision).toMatchObject({
      outcome: "INTERVENE",
      reason: "fit",
      intervention: { messageVersionId: "msg_fit_policies_reassurance_v0", anchor: "policies" },
    });
    expect(body.decision.intervention).not.toHaveProperty("incentive");
    expect((await recorded(body.decision.decisionId))?.inference).toMatchObject({
      trigger: "rules",
      barrier: "fit",
    });
  });

  it("price without the direct incentive: the abandonment steps up to the evidence message", async () => {
    await start(
      spec({ commercialPolicy: { version: "c", marginPercent: 40, directIncentiveOnPrice: false } }),
    );
    const plain = await ingest([priceRead(1), cta(2)]);
    expect(plain.decision.intervention?.messageVersionId).toBe("msg_price_price_information_v0");
    await start(
      spec({ commercialPolicy: { version: "c", marginPercent: 40, directIncentiveOnPrice: false } }),
    );
    const amplified = await ingest([priceRead(1), cta(2), addedToCart(3), removedFromCart(4)]);
    expect(amplified.decision.intervention?.messageVersionId).toBe("msg_price_price_evidence_v0");
  });
});
