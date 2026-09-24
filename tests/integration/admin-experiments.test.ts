// Feature 017 — US3 (spec scenarios 1–8; 03 §4.10; D-G; ADR-022; constitution I): an experiment
// opens in calibration, is activated — from there the configuration is frozen and only a
// corrective version restarts the window — and closes for good; at most one open per merchant;
// the kill switch never touches it; nothing crosses merchants.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { replace } from "../../src/composition/graph/index.js";
import { DecisionLedgerPort } from "../../src/composition/modules/ledger.js";
import { ClockPort } from "../../src/composition/modules/shared-kernel.js";
import { asDecisionId } from "../../src/domain/ledger/index.js";
import { asMerchantId } from "../../src/domain/shared-kernel/index.js";
import { json, problemOf } from "../helpers/json.js";
import {
  admin,
  eventOf,
  fixedClock,
  merchantB,
  NOW,
  postEvents,
  sharedTestApp,
  type MerchantSpec,
  type SharedApp,
  type TestOperator,
} from "../helpers/test-app.js";
import type { components } from "#generated/api.js";

type IngestResult = components["schemas"]["IngestResult"];
type Experiment = components["schemas"]["Experiment"];
type ExperimentPage = components["schemas"]["ExperimentPage"];
type AdminEntryPage = components["schemas"]["AdminEntryPage"];

const KEY = "key-a-1";
const A = "m_a";
const PAGE = { pageType: "product", productId: "SKU-1", variantId: "SKU-1-M" };

/** A without any experiment: the operator opens one; the whole traffic may go to OPE. */
const merchantA: MerchantSpec = {
  merchantId: A,
  ingestKeys: [KEY],
  platformKeys: ["platform-a-1"],
  origins: ["https://a.example"],
  evidenceProfile: { returnsPolicy: true, fitData: true },
  declared: { holdoutShare: 0 },
  experiments: [],
};

/** B keeps the holdout of the treatment defaults: it declares nothing of it. */
const merchantBWithHoldout: MerchantSpec = { ...merchantB, declared: {} };

let app: SharedApp;
beforeAll(async () => {
  app = await sharedTestApp(
    { ports: [replace(ClockPort, fixedClock(NOW))] },
    { merchants: [merchantA, merchantBWithHoldout] },
  );
});
beforeEach(async () => {
  await app.resetPorts();
});
afterAll(async () => {
  await app.close();
});

const EXPERIMENT = { treatmentShare: 1, seed: "pilot", targetSample: 32_000, cuts: [0.33, 0.66] };

const open = (body: unknown = EXPERIMENT, o: { as?: TestOperator; merchant?: string } = {}) =>
  admin(app.app, "POST", `/v1/admin/merchants/${o.merchant ?? A}/experiments`, {
    body,
    ...(o.as ? { as: o.as } : {}),
  });
const transition = (
  id: string,
  action: "activate" | "close",
  o: { as?: TestOperator; merchant?: string } = {},
) =>
  admin(app.app, "POST", `/v1/admin/merchants/${o.merchant ?? A}/experiments/${id}/${action}`, {
    ...(o.as ? { as: o.as } : {}),
  });
const configure = (declared: unknown, over: Record<string, unknown> = {}) =>
  admin(app.app, "POST", `/v1/admin/merchants/${A}/configuration`, { body: { declared, ...over } });

async function opened(): Promise<Experiment> {
  const res = await open();
  expect(res.statusCode).toBe(201);
  return json(res) as Experiment;
}

let n = 0;
/** A batch of one visitor of A; the decision it produces. */
async function decide(visitorId = "vis_00000001"): Promise<IngestResult> {
  const res = await postEvents(
    app.app,
    { events: [eventOf(++n, { occurredAt: NOW, page: PAGE, visitorId, sessionId: `ses_${visitorId}` })] },
    { key: KEY },
  );
  expect(res.statusCode).toBe(202);
  return json(res) as IngestResult;
}
const recorded = (decisionId: string) =>
  app.resolve(DecisionLedgerPort).find(asMerchantId(A), asDecisionId(decisionId));

describe("opening an experiment (scenarios 1, 6)", () => {
  it("opens in calibration: 201 with an identifier, the split, the target, the cuts and the opening; never the seed", async () => {
    const experiment = await opened();
    expect(experiment).toEqual({
      experimentId: expect.stringMatching(/^exp_[a-z2-7]{12}$/) as string,
      status: "calibrating",
      treatmentShare: 1,
      targetSample: 32_000,
      cuts: [0.33, 0.66],
      openedAt: NOW,
      windowRestarts: [],
    });
    expect(JSON.stringify(experiment)).not.toContain("pilot");
    const page = json(await admin(app.app, "GET", `/v1/admin/merchants/${A}/experiments`)) as ExperimentPage;
    expect(page.items).toEqual([experiment]);
  });

  it("while calibrating the visitors are assigned and OPE decides, every decision marked as calibration and never sent as such", async () => {
    const experiment = await opened();
    const result = await decide();
    expect(result.decision.reason).not.toBe("no-active-experiment");
    const kept = await recorded(result.decision.decisionId);
    expect(kept?.phase).toBe("calibration");
    expect(kept?.experiment).toEqual({ experimentId: experiment.experimentId, arm: "TREATMENT" });
    expect(JSON.stringify(result)).not.toMatch(/calibrat|TREATMENT/);
  });

  it("without cuts the target sample is the only cut; a body outside the schema is 400", async () => {
    const res = await open({ treatmentShare: 0.5, seed: "s", targetSample: 10 });
    expect(res.statusCode).toBe(201);
    expect((json(res) as Experiment).cuts).toEqual([]);
    expect((await open({ treatmentShare: 0.5, seed: "s" })).statusCode).toBe(400);
    expect((await open({ ...EXPERIMENT, treatmentShare: 1.01 })).statusCode).toBe(400);
  });

  it("[invariant:invalid-experiment-cuts] cuts that do not increase are refused and nothing opens", async () => {
    const res = await open({ ...EXPERIMENT, cuts: [0.66, 0.33] });
    expect(res.statusCode).toBe(422);
    expect(problemOf(res)).toMatchObject({ type: "urn:ope:problem:invalid-experiment-cuts" });
    expect((await decide()).decision.reason).toBe("no-active-experiment");
  });

  it("[invariant:treatment-exceeds-holdout] the split may not take the holdout of the merchant; what the merchant declares of it counts", async () => {
    // B keeps the default holdout of the release; A declared none.
    const res = await open({ ...EXPERIMENT, treatmentShare: 0.96 }, { merchant: "m_b" });
    expect(res.statusCode).toBe(422);
    expect(problemOf(res)).toMatchObject({ type: "urn:ope:problem:treatment-exceeds-holdout" });
    expect((await open({ ...EXPERIMENT, treatmentShare: 0.95 }, { merchant: "m_b" })).statusCode).toBe(201);
    expect((await open({ ...EXPERIMENT, treatmentShare: 1 })).statusCode).toBe(201);
    const log = json(await admin(app.app, "GET", "/v1/admin/merchants/m_b/log?limit=2")) as AdminEntryPage;
    expect(log.items.map((e) => [e.operation, e.outcome, e.code])).toEqual([
      ["createExperiment", "accepted", undefined],
      ["createExperiment", "rejected", "treatment-exceeds-holdout"],
    ]);
  });

  it("at most one open experiment per merchant: a second one is 409 while the first calibrates or runs, and opens once it closes", async () => {
    const first = await opened();
    const second = await open();
    expect(second.statusCode).toBe(409);
    expect(problemOf(second)).toMatchObject({ type: "urn:ope:problem:experiment-already-open" });
    expect((await transition(first.experimentId, "activate")).statusCode).toBe(200);
    expect((await open()).statusCode).toBe(409);
    expect((await transition(first.experimentId, "close")).statusCode).toBe(200);
    const third = await open();
    expect(third.statusCode).toBe(201);
    const page = json(await admin(app.app, "GET", `/v1/admin/merchants/${A}/experiments`)) as ExperimentPage;
    expect(page.items.map((e) => [e.experimentId, e.status])).toEqual([
      [(json(third) as Experiment).experimentId, "calibrating"],
      [first.experimentId, "closed"],
    ]);
  });
});

describe("calibration, activation and the frozen configuration (scenarios 2, 3, 4, 5)", () => {
  it("in calibration a version is published and stamped normally; activation starts the window and freezes the configuration", async () => {
    const experiment = await opened();
    const published = await configure({ holdoutShare: 0, freshness: { stockAndPriceMs: 600_000 } });
    expect(published.statusCode).toBe(201);
    const activated = await transition(experiment.experimentId, "activate");
    expect(activated.statusCode).toBe(200);
    expect(json(activated)).toEqual({
      ...experiment,
      status: "active",
      activatedAt: NOW,
      windowStartedAt: NOW,
    });
    const result = await decide();
    const kept = await recorded(result.decision.decisionId);
    expect(kept?.phase).toBeUndefined();
    expect(kept?.configuration).toEqual({ platform: "platform-1", defaults: "defaults-1", merchant: 2 });
    const frozen = await configure({ holdoutShare: 0, freshness: { stockAndPriceMs: 300_000 } });
    expect(frozen.statusCode).toBe(409);
    expect(problemOf(frozen)).toMatchObject({ type: "urn:ope:problem:configuration-frozen" });
    const versions = json(await admin(app.app, "GET", `/v1/admin/merchants/${A}/configuration/versions`)) as {
      items: { version: number }[];
    };
    expect(versions.items.map((v) => v.version)).toEqual([2, 1]);
    // Activating again changes nothing.
    expect(json(await transition(experiment.experimentId, "activate"))).toEqual(json(activated));
  });

  it("a corrective version with its reason is accepted, restarts the window, and the log keeps the version, the reason and the restart", async () => {
    // A clock the test moves: the activation and the restart happen at different instants.
    let current = new Date(NOW);
    await app.resetPorts({ ports: [replace(ClockPort, { now: () => current })] });
    const experiment = await opened();
    expect((await transition(experiment.experimentId, "activate")).statusCode).toBe(200);
    const later = new Date(new Date(NOW).getTime() + 60_000);
    current = later;
    const corrective = await configure(
      { holdoutShare: 0, freshness: { stockAndPriceMs: 600_000 } },
      { corrective: true, reason: "anchor fix" },
    );
    expect(corrective.statusCode).toBe(201);
    const page = json(await admin(app.app, "GET", `/v1/admin/merchants/${A}/experiments`)) as ExperimentPage;
    expect(page.items[0]).toMatchObject({
      status: "active",
      activatedAt: NOW,
      windowStartedAt: later.toISOString(),
      windowRestarts: [{ at: later.toISOString(), reason: "anchor fix", configurationVersion: 2 }],
    });
    const log = json(await admin(app.app, "GET", `/v1/admin/merchants/${A}/log?limit=1`)) as AdminEntryPage;
    expect(log.items[0]).toMatchObject({
      operation: "publishMerchantConfiguration",
      outcome: "accepted",
      reason: "anchor fix",
      result: { configurationVersion: 2, windowRestarted: true },
    });
  });

  it("a corrective version while the experiment calibrates is a plain version: no window to restart", async () => {
    await opened();
    const corrective = await configure({ holdoutShare: 0 }, { corrective: true, reason: "early" });
    expect(corrective.statusCode).toBe(201);
    const log = json(await admin(app.app, "GET", `/v1/admin/merchants/${A}/log?limit=1`)) as AdminEntryPage;
    expect(log.items[0]?.result).toEqual({ configurationVersion: 2, windowRestarted: false });
    const page = json(await admin(app.app, "GET", `/v1/admin/merchants/${A}/experiments`)) as ExperimentPage;
    expect(page.items[0]?.windowRestarts).toEqual([]);
  });
});

describe("closing (scenario 7) and the kill switch (scenario 8)", () => {
  it("closed: nobody new is assigned, decisions resolve no-active-experiment, what was recorded stays, and it cannot be reopened", async () => {
    const experiment = await opened();
    const before = await decide("vis_00000001");
    const closed = await transition(experiment.experimentId, "close");
    expect(closed.statusCode).toBe(200);
    expect(json(closed)).toMatchObject({ status: "closed", closedAt: NOW });
    const after = await decide("vis_00000002");
    expect(after.decision.reason).toBe("no-active-experiment");
    expect((await recorded(before.decision.decisionId))?.experiment?.experimentId).toBe(
      experiment.experimentId,
    );
    const reopen = await transition(experiment.experimentId, "activate");
    expect(reopen.statusCode).toBe(409);
    expect(problemOf(reopen)).toMatchObject({ type: "urn:ope:problem:experiment-not-open" });
    expect(json(await transition(experiment.experimentId, "close"))).toEqual(json(closed));
  });

  it("the kill switch does not change the state of an active experiment: off, decisions are merchant-off; on again, the window is untouched", async () => {
    const experiment = await opened();
    const activated = json(await transition(experiment.experimentId, "activate")) as Experiment;
    const off = await admin(app.app, "PUT", `/v1/admin/merchants/${A}/kill-switch`, {
      body: { enabled: false },
    });
    expect(off.statusCode).toBe(200);
    expect((await decide()).decision.reason).toBe("merchant-off");
    const page = json(await admin(app.app, "GET", `/v1/admin/merchants/${A}/experiments`)) as ExperimentPage;
    expect(page.items[0]).toEqual(activated);
    await admin(app.app, "PUT", `/v1/admin/merchants/${A}/kill-switch`, { body: { enabled: true } });
    expect((await decide("vis_00000009")).decision.reason).not.toBe("merchant-off");
    const log = json(await admin(app.app, "GET", `/v1/admin/merchants/${A}/log?limit=4`)) as AdminEntryPage;
    expect(log.items.map((e) => e.operation)).toEqual([
      "setKillSwitch",
      "setKillSwitch",
      "activateExperiment",
      "createExperiment",
    ]);
    expect(log.items[2]?.result).toEqual({ experimentId: experiment.experimentId });
  });
});

describe("isolation and scope", () => {
  it("an unknown experiment is 404; an operator scoped to A cannot see nor move the experiments of B", async () => {
    const missing = await transition("exp_unknown_001", "activate");
    expect(missing.statusCode).toBe(404);
    expect(problemOf(missing)).toMatchObject({ type: "urn:ope:problem:experiment-not-found" });
    const b = await open({ ...EXPERIMENT, treatmentShare: 0.5 }, { merchant: "m_b" });
    expect(b.statusCode).toBe(201);
    const id = (json(b) as Experiment).experimentId;
    expect((await open(EXPERIMENT, { merchant: "m_b", as: "ops-a" })).statusCode).toBe(403);
    expect((await transition(id, "close", { merchant: "m_b", as: "ops-a" })).statusCode).toBe(403);
    expect(
      (await admin(app.app, "GET", "/v1/admin/merchants/m_b/experiments", { as: "ops-a" })).statusCode,
    ).toBe(403);
    // The experiment of B is not reachable through A.
    expect((await transition(id, "close")).statusCode).toBe(404);
    const ofA = json(
      await admin(app.app, "GET", `/v1/admin/merchants/${A}/experiments`, { as: "ops-a" }),
    ) as ExperimentPage;
    expect(ofA.items).toEqual([]);
  });
});
