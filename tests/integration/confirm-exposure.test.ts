// US4 (FR-030, FR-031, FR-050; ADR-014): POST /v1/exposures de punta a punta.
import { afterEach, describe, expect, it } from "vitest";
import { json, problemOf } from "../helpers/json.js";
import { batchOf, fixedClock, postEvents, postExposure, startTestApp } from "../helpers/test-app.js";
import type { App } from "../../src/composition/bootstrap.js";
import type { Decision } from "../../src/domain/ledger/index.js";
import type { components } from "../../src/interface-adapters/http/client.js";

type IngestResult = components["schemas"]["IngestResult"];

let app: App | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

const NOW = "2026-09-16T12:00:00.000Z";
const withClock = () => startTestApp({ ports: { clock: fixedClock(NOW) } });

const exposure = (decisionId: string, over: Record<string, unknown> = {}) => ({
  decisionId,
  sessionId: "ses_00000001",
  visitorId: "vis_00000001",
  exposedAt: NOW,
  anchor: "size_selector",
  ...over,
});

/** Ninguna ruta HTTP produce INTERVENE en esta feature: se inyecta por el puerto del ledger. */
async function interveneDecision(a: App, merchantId: string, decisionId: string): Promise<void> {
  const decision: Decision = {
    decisionId: decisionId as Decision["decisionId"],
    merchantId: merchantId as Decision["merchantId"],
    sessionId: "ses_00000001" as Decision["sessionId"],
    visitorId: "vis_00000001" as Decision["visitorId"],
    decidedAt: new Date(NOW),
    outcome: "INTERVENE",
    reason: "barrier-size",
    intervention: { messageVersionId: "msg-1", anchor: "size_selector" },
  };
  await a.ports.decisions.record(decision);
}

async function noOpDecisionId(a: App, key: string): Promise<string> {
  const res = await postEvents(a.app, batchOf(1, 1, { occurredAt: NOW }), { key });
  return (json(res) as IngestResult).decision.decisionId;
}

describe("POST /v1/exposures", () => {
  it("[invariant:exposure-decision-unknown] decisionId inventado → 422 con su tipo", async () => {
    app = await withClock();
    const res = await postExposure(app.app, exposure("dec_nadie0000"), { key: "key-a-1" });
    expect(res.statusCode).toBe(422);
    expect(res.headers["content-type"]).toMatch("application/problem+json");
    expect(problemOf(res)).toMatchObject({ type: "urn:ope:problem:exposure-decision-unknown", status: 422 });
  });

  it("decisión de otro merchant → la misma respuesta que inexistente (aislamiento FR-050, no revela)", async () => {
    app = await withClock();
    await interveneDecision(app, "m_b", "dec_de_b_00001");
    const res = await postExposure(app.app, exposure("dec_de_b_00001"), { key: "key-a-1" });
    expect(res.statusCode).toBe(422);
    expect(problemOf(res).type).toBe("urn:ope:problem:exposure-decision-unknown");
    expect(res.body).not.toContain("m_b");
  });

  it("[invariant:exposure-of-no-op] decisión NO_OP real (de un lote) → 422 con su tipo", async () => {
    app = await withClock();
    const decisionId = await noOpDecisionId(app, "key-a-1");
    const res = await postExposure(app.app, exposure(decisionId), { key: "key-a-1" });
    expect(res.statusCode).toBe(422);
    expect(problemOf(res)).toMatchObject({ type: "urn:ope:problem:exposure-of-no-op", status: 422 });
  });

  it("decisión INTERVENE propia → 201 recorded; repetida → 200 already-recorded; una sola exposición", async () => {
    app = await withClock();
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

  it("campo extra → 400; sin clave → 401; Origin de otro merchant → 403", async () => {
    app = await withClock();
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
