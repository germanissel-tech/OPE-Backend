// FR-050, SC-005 (constitution V): isolation between merchants, in a single readable suite.
// A and B are the merchants of tests/helpers/test-app.ts; each case names both.
import { afterEach, describe, expect, it } from "vitest";
import { InterveneDecision, asDecisionId } from "../../src/domain/ledger/index.js";
import { asMerchantId, asSessionId, asVisitorId } from "../../src/domain/shared-kernel/index.js";
import { json, problemOf } from "../helpers/json.js";
import {
  batchOf,
  fixedClock,
  merchantB,
  postEvents,
  postExposure,
  startTestApp,
  type MerchantSpec,
} from "../helpers/test-app.js";
import type { App } from "../../src/composition/bootstrap.js";
import type { Assignment } from "../../src/domain/experiment/index.js";
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
  await app.ports.decisions.record(decision);
}

describe("isolation between merchants", () => {
  it("deduplication: the same eventId in A and in B comes in for both", async () => {
    app = await startTestApp({ ports: { clock: fixedClock(NOW) } });
    expect(await ingest(A.key)).toMatchObject({ accepted: 2, duplicates: 0 });
    expect(await ingest(B.key)).toMatchObject({ accepted: 2, duplicates: 0 });
    expect(await ingest(A.key)).toMatchObject({ accepted: 0, duplicates: 2 });
  });

  it("decisions: a decision of A does not exist for B (neither through the port nor through HTTP)", async () => {
    app = await startTestApp({ ports: { clock: fixedClock(NOW) } });
    const { decision } = await ingest(A.key);
    expect(await app.ports.decisions.find(A.id as never, decision.decisionId as never)).toBeDefined();
    expect(await app.ports.decisions.find(B.id as never, decision.decisionId as never)).toBeUndefined();
    const res = await postExposure(app.app, exposureOf(decision.decisionId), { key: B.key });
    expect(res.statusCode).toBe(422);
    expect(problemOf(res).type).toBe("urn:ope:problem:exposure-decision-unknown");
  });

  it("exposures: A exposes its intervention; B neither sees it nor can expose it", async () => {
    app = await startTestApp({ ports: { clock: fixedClock(NOW) } });
    await intervene(A.id, "dec_de_a_00001");
    expect((await postExposure(app.app, exposureOf("dec_de_a_00001"), { key: A.key })).statusCode).toBe(201);
    expect(await app.ports.exposures.find(B.id as never, "dec_de_a_00001" as never)).toBeUndefined();
    const asB = await postExposure(app.app, exposureOf("dec_de_a_00001"), { key: B.key });
    expect(asB.statusCode).toBe(422);
  });

  it("origins: the key of A with the Origin of B → 403; each with its own origin → passes", async () => {
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

  it("credentials: the key of B does not resolve to A; no response names the other merchant", async () => {
    app = await startTestApp({ ports: { clock: fixedClock(NOW) } });
    const { decision } = await ingest(A.key);
    const res = await postExposure(app.app, exposureOf(decision.decisionId), { key: B.key });
    expect(res.body).not.toMatch(/m_a|key-a/);
  });

  it("assignments: the same visitor in two merchants with active experiments is assigned independently; nothing crosses", async () => {
    const experiment = (seed: string) => ({
      experimentId: "exp_iso_00001",
      treatmentPercent: 50,
      seed,
      status: "active" as const,
      startedAt: NOW,
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
    app = await startTestApp(
      { ports: { clock: fixedClock(NOW) } },
      { merchants: [merchantA, merchantB, merchantC] },
    );
    // Over many visitors the two merchants must disagree about half of the time (seeds differ).
    let disagree = 0;
    const visitors = 60;
    for (let n = 1; n <= visitors; n += 1) {
      const visitorId = `vis_iso_${String(n).padStart(6, "0")}`;
      await postEvents(app.app, batchOf(1, n, { occurredAt: NOW, visitorId }), { key: A.key });
      await postEvents(app.app, batchOf(1, n, { occurredAt: NOW, visitorId }), { key: "key-c-1" });
      const inA = await app.ports.assignments.find(
        A.id as never,
        "exp_iso_00001" as never,
        visitorId as never,
      );
      const inC = await app.ports.assignments.find(
        "m_c" as never,
        "exp_iso_00001" as never,
        visitorId as never,
      );
      expect(inA?.merchantId).toBe(A.id);
      expect(inC?.merchantId).toBe("m_c");
      if (inA?.arm !== inC?.arm) disagree += 1;
      expect(
        await app.ports.assignments.find(B.id as never, "exp_iso_00001" as never, visitorId as never),
      ).toBeUndefined();
    }
    expect(disagree).toBeGreaterThan(visitors * 0.2);
    expect(disagree).toBeLessThan(visitors * 0.8);
  });

  it("experiments: a closed and an active experiment of the same merchant do not share assignments", async () => {
    const closed = {
      experimentId: "exp_closed_001",
      treatmentPercent: 50,
      seed: "old",
      status: "closed" as const,
      startedAt: NOW,
    };
    const active = {
      experimentId: "exp_active_01",
      treatmentPercent: 50,
      seed: "new",
      status: "active" as const,
      startedAt: NOW,
    };
    const merchantA: MerchantSpec = {
      merchantId: A.id,
      ingestKeys: [A.key],
      origins: [A.origin],
      experiments: [closed, active],
    };
    app = await startTestApp({ ports: { clock: fixedClock(NOW) } }, { merchants: [merchantA, merchantB] });
    const stale: Assignment = {
      merchantId: A.id as Assignment["merchantId"],
      experimentId: "exp_closed_001" as Assignment["experimentId"],
      visitorId: "vis_00000001" as Assignment["visitorId"],
      arm: "TREATMENT",
      assignedAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    await app.ports.assignments.record(stale);
    await ingest(A.key);
    expect(
      await app.ports.assignments.find(A.id as never, "exp_closed_001" as never, "vis_00000001" as never),
    ).toEqual(stale);
    const fresh = await app.ports.assignments.find(
      A.id as never,
      "exp_active_01" as never,
      "vis_00000001" as never,
    );
    expect(fresh).toMatchObject({ experimentId: "exp_active_01", assignedAt: new Date(NOW) });
  });
});
