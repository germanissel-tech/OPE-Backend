// US2 and US3 (FR-010..FR-013, FR-020..FR-024, SC-002, SC-003; constitution III; ADR-022): the
// assignment is recorded with the first accepted batch, once; CONTROL runs the same pipeline
// and always resolves NO_OP `control-arm`; the arm never travels as a field.
import { afterEach, describe, expect, it } from "vitest";
import { Experiment } from "../../src/domain/experiment/index.js";
import { asExperimentId, asMerchantId, asVisitorId } from "../../src/domain/shared-kernel/index.js";
import { json, problemOf } from "../helpers/json.js";
import {
  batchOf,
  eventOf,
  fixedClock,
  merchantB,
  postEvents,
  postExposure,
  startTestApp,
  type MerchantSpec,
} from "../helpers/test-app.js";
import type { App } from "../../src/composition/bootstrap.js";
import type { components } from "../../src/interface-adapters/http/client.js";

type IngestResult = components["schemas"]["IngestResult"];

const NOW = "2026-09-17T12:00:00.000Z";
const KEY = "key-a-1";
const EXPERIMENT_ID = "exp_a_5050001";
const experimentConfig = {
  experimentId: EXPERIMENT_ID,
  treatmentPercent: 50,
  seed: "seed-5050",
  status: "active" as const,
  startedAt: NOW,
};
const merchantA: MerchantSpec = {
  merchantId: "m_a",
  ingestKeys: [KEY, "key-a-2"],
  origins: ["https://a.example"],
  experiments: [experimentConfig],
};
const experiment = Experiment.rehydrate({
  experimentId: asExperimentId(EXPERIMENT_ID),
  merchantId: asMerchantId("m_a"),
  treatmentShare: 0.5,
  seed: "seed-5050",
  status: "active",
  startedAt: new Date(NOW),
});

/** The first visitor id of each arm, chosen with the domain function so the test does not guess. */
function visitorIn(arm: "CONTROL" | "TREATMENT"): string {
  for (let n = 1; n < 10_000; n += 1) {
    const id = `vis_${String(n).padStart(8, "0")}`;
    if (experiment.assign(asVisitorId(id)) === arm) return id;
  }
  throw new Error(`no visitor found for ${arm}`);
}
const control = visitorIn("CONTROL");
const treatment = visitorIn("TREATMENT");

let app: App;
afterEach(async () => {
  await app.close();
});

const start = () =>
  startTestApp({ ports: { clock: fixedClock(NOW) } }, { merchants: [merchantA, merchantB] });
const batchFor = (visitorId: string, n: number, from = 1) => batchOf(n, from, { occurredAt: NOW, visitorId });
const find = (visitorId: string) =>
  app.ports.assignments.find("m_a" as never, EXPERIMENT_ID as never, visitorId as never);

describe("assignment (ASSIGNED)", () => {
  it("the first accepted batch records one assignment with merchant, experiment, visitor, arm and the clock's instant", async () => {
    app = await start();
    expect((await postEvents(app.app, batchFor(control, 2), { key: KEY })).statusCode).toBe(202);
    expect(await find(control)).toEqual({
      merchantId: "m_a",
      experimentId: EXPERIMENT_ID,
      visitorId: control,
      arm: "CONTROL",
      assignedAt: new Date(NOW),
    });
  });

  it("idempotency: ten more batches leave exactly one assignment and the arm does not change", async () => {
    app = await start();
    await postEvents(app.app, batchFor(treatment, 1, 1), { key: KEY });
    const first = await find(treatment);
    for (let i = 1; i <= 10; i += 1) {
      await postEvents(app.app, batchFor(treatment, 1, 100 + i), { key: KEY });
    }
    expect(await find(treatment)).toEqual(first);
  });

  it("a rejected batch (invariant or contract) does not assign", async () => {
    app = await start();
    const mixed = {
      events: [
        eventOf(1, { occurredAt: NOW, visitorId: control }),
        eventOf(2, { occurredAt: NOW, visitorId: treatment }),
      ],
    };
    expect((await postEvents(app.app, mixed, { key: KEY })).statusCode).toBe(422);
    expect(
      (
        await postEvents(
          app.app,
          { events: [eventOf(3, { occurredAt: NOW, visitorId: control, foo: 1 })] },
          { key: KEY },
        )
      ).statusCode,
    ).toBe(400);
    expect(await find(control)).toBeUndefined();
    expect(await find(treatment)).toBeUndefined();
  });

  it("CONTROL runs the whole pipeline and resolves NO_OP control-arm; the decision records the arm and the experiment", async () => {
    app = await start();
    const res = await postEvents(app.app, batchFor(control, 2), { key: KEY });
    const body = json(res) as IngestResult;
    expect(body).toMatchObject({ accepted: 2, decision: { outcome: "NO_OP", reason: "control-arm" } });
    const decision = await app.ports.decisions.find("m_a" as never, body.decision.decisionId as never);
    expect(decision?.experiment).toEqual({ experimentId: EXPERIMENT_ID, arm: "CONTROL" });
  });

  it("TREATMENT goes through the decision plane (no signal → barrier-unclear) and records the arm too", async () => {
    app = await start();
    const body = json(await postEvents(app.app, batchFor(treatment, 1), { key: KEY })) as IngestResult;
    expect(body.decision.reason).toBe("barrier-unclear");
    const decision = await app.ports.decisions.find("m_a" as never, body.decision.decisionId as never);
    expect(decision?.experiment).toEqual({ experimentId: EXPERIMENT_ID, arm: "TREATMENT" });
  });

  it("a merchant without an active experiment assigns nobody and resolves NO_OP no-active-experiment", async () => {
    app = await start();
    const body = json(await postEvents(app.app, batchFor(control, 1), { key: "key-b-1" })) as IngestResult;
    expect(body.decision.reason).toBe("no-active-experiment");
    expect(
      await app.ports.assignments.find("m_b" as never, EXPERIMENT_ID as never, control as never),
    ).toBeUndefined();
    const decision = await app.ports.decisions.find("m_b" as never, body.decision.decisionId as never);
    expect(decision?.experiment).toBeUndefined();
  });

  it("the arm and the experiment never travel as fields in any response (SC-003)", async () => {
    app = await start();
    const ingest = await postEvents(app.app, batchFor(control, 1), { key: KEY });
    const decisionId = (json(ingest) as IngestResult).decision.decisionId;
    const exposure = await postExposure(
      app.app,
      { decisionId, sessionId: "ses_00000001", visitorId: control, exposedAt: NOW, anchor: "size_selector" },
      { key: KEY },
    );
    for (const body of [ingest.body, exposure.body]) {
      expect(body).not.toMatch(/"arm"|"experimentId"|CONTROL|TREATMENT/);
    }
    expect(exposure.statusCode).toBe(422);
    expect(problemOf(exposure).type).toBe("urn:ope:problem:exposure-of-no-op");
  });
});
