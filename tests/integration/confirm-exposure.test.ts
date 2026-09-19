// US4 (FR-030, FR-031, FR-050; ADR-014): POST /v1/exposures end to end.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { InterveneDecision, asDecisionId } from "../../src/domain/ledger/index.js";
import { asMerchantId, asSessionId, asVisitorId } from "../../src/domain/shared-kernel/index.js";
import { json, problemOf } from "../helpers/json.js";
import {
  batchOf,
  fixedClock,
  postEvents,
  postExposure,
  sharedTestApp,
  type SharedApp,
} from "../helpers/test-app.js";
import type { components } from "../../src/interface-adapters/http/client.js";

type IngestResult = components["schemas"]["IngestResult"];

const NOW = "2026-09-16T12:00:00.000Z";
// One server per file (015 F-055): the in-memory ports are rebuilt before each test.
let app: SharedApp;
beforeAll(async () => {
  app = await sharedTestApp({ ports: { clock: fixedClock(NOW) } });
});
beforeEach(() => {
  app.resetPorts();
});
afterAll(async () => {
  await app.close();
});

const exposure = (decisionId: string, over: Record<string, unknown> = {}) => ({
  decisionId,
  sessionId: "ses_00000001",
  visitorId: "vis_00000001",
  exposedAt: NOW,
  anchor: "size_selector",
  ...over,
});

/** No HTTP route produces INTERVENE in this feature: it is injected through the ledger port. */
async function interveneDecision(a: SharedApp, merchantId: string, decisionId: string): Promise<void> {
  const decision = InterveneDecision.of(
    {
      decisionId: asDecisionId(decisionId),
      merchantId: asMerchantId(merchantId),
      sessionId: asSessionId("ses_00000001"),
      visitorId: asVisitorId("vis_00000001"),
      decidedAt: new Date(NOW),
    },
    "barrier-size",
    { messageVersionId: "msg-1", anchor: "size_selector" },
  );
  await a.ports.decisions.record(decision);
}

async function noOpDecisionId(a: SharedApp, key: string): Promise<string> {
  const res = await postEvents(a.app, batchOf(1, 1, { occurredAt: NOW }), { key });
  return (json(res) as IngestResult).decision.decisionId;
}

describe("POST /v1/exposures", () => {
  it("[invariant:exposure-decision-unknown] made-up decisionId → 422 with its type", async () => {
    const res = await postExposure(app.app, exposure("dec_nadie0000"), { key: "key-a-1" });
    expect(res.statusCode).toBe(422);
    expect(res.headers["content-type"]).toMatch("application/problem+json");
    expect(problemOf(res)).toMatchObject({ type: "urn:ope:problem:exposure-decision-unknown", status: 422 });
  });

  it("decision of another merchant → the same response as nonexistent (isolation FR-050, reveals nothing)", async () => {
    await interveneDecision(app, "m_b", "dec_de_b_00001");
    const res = await postExposure(app.app, exposure("dec_de_b_00001"), { key: "key-a-1" });
    expect(res.statusCode).toBe(422);
    expect(problemOf(res).type).toBe("urn:ope:problem:exposure-decision-unknown");
    expect(res.body).not.toContain("m_b");
  });

  it("[invariant:exposure-of-no-op] real NO_OP decision (from a batch) → 422 with its type", async () => {
    const decisionId = await noOpDecisionId(app, "key-a-1");
    const res = await postExposure(app.app, exposure(decisionId), { key: "key-a-1" });
    expect(res.statusCode).toBe(422);
    expect(problemOf(res)).toMatchObject({ type: "urn:ope:problem:exposure-of-no-op", status: 422 });
  });

  it("own INTERVENE decision → 201 recorded; repeated → 200 already-recorded; a single exposure", async () => {
    await interveneDecision(app, "m_a", "dec_intervene1");
    const first = await postExposure(app.app, exposure("dec_intervene1"), { key: "key-a-1" });
    expect(first.statusCode, first.body).toBe(201);
    expect(json(first)).toEqual({ decisionId: "dec_intervene1", status: "recorded" });
    const second = await postExposure(app.app, exposure("dec_intervene1"), { key: "key-a-1" });
    expect(second.statusCode).toBe(200);
    expect(json(second)).toEqual({ decisionId: "dec_intervene1", status: "already-recorded" });
    expect(await app.ports.exposures.find("m_a" as never, "dec_intervene1" as never)).toMatchObject({
      decisionId: "dec_intervene1",
      anchor: "size_selector",
      exposedAt: new Date(NOW),
    });
    expect(await app.ports.exposures.find("m_b" as never, "dec_intervene1" as never)).toBeUndefined();
  });

  it("extra field → 400; no key → 401; Origin of another merchant → 403", async () => {
    await interveneDecision(app, "m_a", "dec_intervene1");
    const extra = await postExposure(app.app, exposure("dec_intervene1", { email: "x" }), { key: "key-a-1" });
    expect(extra.statusCode).toBe(400);
    const noKey = await postExposure(app.app, exposure("dec_intervene1"));
    expect(noKey.statusCode).toBe(401);
    const wrongOrigin = await postExposure(app.app, exposure("dec_intervene1"), {
      key: "key-a-1",
      origin: "https://b.example",
    });
    expect(wrongOrigin.statusCode).toBe(403);
  });
});
