// FR-050, SC-005 (constitución V): aislamiento entre merchants, en una sola suite legible.
// A y B son los merchants de tests/helpers/test-app.ts; cada caso nombra a los dos.
import { afterEach, describe, expect, it } from "vitest";
import { json, problemOf } from "../helpers/json.js";
import { batchOf, fixedClock, postEvents, postExposure, startTestApp } from "../helpers/test-app.js";
import type { App } from "../../src/composition/bootstrap.js";
import type { Decision } from "../../src/domain/ledger/index.js";
import type { components } from "../../src/interface-adapters/http/client.js";

type IngestResult = components["schemas"]["IngestResult"];

const NOW = "2026-09-16T12:00:00.000Z";
const A = { key: "key-a-1", origin: "https://a.example", id: "m_a" };
const B = { key: "key-b-1", origin: "https://b.example", id: "m_b" };

let app: App;
afterEach(async () => {
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
  await app.ports.decisions.record(decision);
}

describe("aislamiento entre merchants", () => {
  it("deduplicación: el mismo eventId en A y en B entra en los dos", async () => {
    app = await startTestApp({ ports: { clock: fixedClock(NOW) } });
    expect(await ingest(A.key)).toMatchObject({ accepted: 2, duplicates: 0 });
    expect(await ingest(B.key)).toMatchObject({ accepted: 2, duplicates: 0 });
    expect(await ingest(A.key)).toMatchObject({ accepted: 0, duplicates: 2 });
  });

  it("decisiones: una decisión de A no existe para B (ni por el puerto ni por HTTP)", async () => {
    app = await startTestApp({ ports: { clock: fixedClock(NOW) } });
    const { decision } = await ingest(A.key);
    expect(await app.ports.decisions.find(A.id as never, decision.decisionId as never)).toBeDefined();
    expect(await app.ports.decisions.find(B.id as never, decision.decisionId as never)).toBeUndefined();
    const res = await postExposure(app.app, exposureOf(decision.decisionId), { key: B.key });
    expect(res.statusCode).toBe(422);
    expect(problemOf(res).type).toBe("urn:ope:problem:exposure-decision-unknown");
  });

  it("exposiciones: A expone su intervención; B no la ve ni puede exponerla", async () => {
    app = await startTestApp({ ports: { clock: fixedClock(NOW) } });
    await intervene(A.id, "dec_de_a_00001");
    expect((await postExposure(app.app, exposureOf("dec_de_a_00001"), { key: A.key })).statusCode).toBe(201);
    expect(await app.ports.exposures.find(B.id as never, "dec_de_a_00001" as never)).toBeUndefined();
    const asB = await postExposure(app.app, exposureOf("dec_de_a_00001"), { key: B.key });
    expect(asB.statusCode).toBe(422);
  });

  it("orígenes: la clave de A con el Origin de B → 403; cada uno con su origen → pasa", async () => {
    app = await startTestApp({ ports: { clock: fixedClock(NOW) } });
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

  it("credenciales: la clave de B no resuelve a A; ninguna respuesta nombra al otro merchant", async () => {
    app = await startTestApp({ ports: { clock: fixedClock(NOW) } });
    const { decision } = await ingest(A.key);
    const res = await postExposure(app.app, exposureOf(decision.decisionId), { key: B.key });
    expect(res.body).not.toMatch(/m_a|key-a/);
  });
});
