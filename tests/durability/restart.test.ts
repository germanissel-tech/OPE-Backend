// The whole server across a restart, through HTTP and nothing else. The other suites here build a
// gateway by hand; this one proves the thing the feature is actually about: **a deploy happens and
// OPE still knows what it decided.**
//
// It is also the only test that runs the durable deployment end to end, so it is what would catch
// a store the boot cannot open, a module left out of the list, or a seed that stops working once
// something is persisted.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { durableDeployment } from "../../src/composition/deployments/durable.js";
import { replace } from "../../src/composition/graph/index.js";
import { EventLogPort } from "../../src/composition/modules/ingestion.js";
import { DecisionLedgerPort } from "../../src/composition/modules/ledger.js";
import { ClockPort } from "../../src/composition/modules/shared-kernel.js";
import { SqlStorePort } from "../../src/composition/release.js";
import { asDecisionId } from "../../src/domain/ledger/index.js";
import { asMerchantId, asSessionId } from "../../src/domain/shared-kernel/index.js";
import { json } from "../helpers/json.js";
import {
  NOW,
  batchOf,
  catalogProductOf,
  eventOf,
  fixedClock,
  postEvents,
  putCatalog,
  startTestApp,
  type MerchantSpec,
  type TestConfig,
} from "../helpers/test-app.js";
import type { components } from "#generated/api.js";
import type { App } from "../../src/composition/bootstrap.js";

type IngestResult = components["schemas"]["IngestResult"];

const MERCHANT = asMerchantId("m_a");

let dir: string;
let file: string;
let app: App;

/**
 * A boot of the server on the same file: what a deploy or a crash and a start again amount to.
 * The clock is fixed because the batches of the helpers are dated, not because anything here is
 * about time — with the real clock every event is too far in the past to be accepted.
 */
async function boot(over: TestConfig = {}): Promise<App> {
  return startTestApp(
    { deployment: durableDeployment, ports: [replace(ClockPort, fixedClock())] },
    { store: { file }, ...over },
  );
}

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "ope-restart-"));
  file = path.join(dir, "ope.db");
  app = await boot();
});

afterEach(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("the server across a restart", () => {
  it("starts on an empty store, and a ledger with no records is a valid ledger", async () => {
    // The edge case of the spec: nothing recorded yet is not an error, and the server answers.
    const decisions = app.resolve(DecisionLedgerPort);
    expect(await decisions.bySession(MERCHANT, asSessionId("ses_00000001"))).toEqual([]);
  });

  it("still knows the decision it took before the restart", async () => {
    const response = await postEvents(app.app, batchOf(1, 1), { key: "key-a-1" });
    expect(response.statusCode).toBe(202);
    const { decision } = json(response) as IngestResult;

    await app.close();
    app = await boot();

    const found = await app.resolve(DecisionLedgerPort).find(MERCHANT, asDecisionId(decision.decisionId));
    expect(found?.decisionId).toBe(decision.decisionId);
    expect(found?.outcome).toBe(decision.outcome);
    expect(found?.reason).toBe(decision.reason);
  });

  it("re-imports the seed onto a store that already holds the ledger, and starts", async () => {
    await postEvents(app.app, batchOf(1, 1), { key: "key-a-1" });

    await app.close();
    app = await boot();

    // The merchants and experiments are rebuilt from the seed at every start and are *not*
    // durable yet (spec, "what this feature does not do"). Booting a second time over a store
    // that is no longer empty is where that combination would break, so it is asserted: the
    // server answers a request signed with the same key as before.
    const again = await postEvents(app.app, batchOf(2, 1), { key: "key-a-1" });
    expect(again.statusCode).toBe(202);
  });

  it("still knows what the SDK sent before the restart, because stopping drained the queue", async () => {
    // Feature 031, FR-017 and FR-009 at the same time, end to end and through the real deployment —
    // which is where the ordering matters: the register's queue is created **after** the store, so the
    // graph closing in reverse creation order drains it **before** closing what it writes to. Get that
    // backwards and this test finds it, because the drain would write to a closed store.
    const response = await postEvents(app.app, batchOf(2, 1), { key: "key-a-1" });
    const { decision } = json(response) as IngestResult;

    await app.close();
    app = await boot();

    const arrived = await app.resolve(EventLogPort).byDecision(MERCHANT, asDecisionId(decision.decisionId));
    expect(arrived).toHaveLength(2);
    expect(arrived.map((row) => row.position)).toEqual([0, 1]);
    // And nothing is reported as missing, because nothing was: the reconciliation of FR-018 runs at
    // every boot and this one is clean.
    expect(await app.resolve(EventLogPort).unrecorded()).toBeUndefined();
  });
});

/**
 * The merchants of this suite, declared here rather than taken from the helpers because the caps are
 * the subject: `interventionsPerSession` and `interventionsPerVisitorPerDay` are what has to survive,
 * so a test that inherited them would be asserting a default it did not choose.
 *
 * `cooldownSeconds: 0` matters more than it looks. The session budget and the cooldown answer the
 * **same** `NO_OP session-budget-exhausted`, so with a cooldown a second batch would be refused for
 * the wrong reason and the test would pass without the count ever having been rebuilt.
 */
const withCaps = (id: string, key: string, platformKey: string, perDay: number): MerchantSpec => ({
  merchantId: id,
  ingestKeys: [key],
  platformKeys: [platformKey],
  origins: [`https://${id}.example`],
  evidenceProfile: { returnsPolicy: true, fitData: true },
  declared: { holdoutShare: 0 },
  experiments: [
    {
      experimentId: `exp_${id}_0001`,
      treatmentShare: 1,
      seed: `seed-${id}`,
      status: "active",
      openedAt: "2026-09-17T00:00:00Z",
    },
  ],
  commercialPolicy: {
    version: `${id}-caps`,
    interventionsPerSession: 1,
    cooldownSeconds: 0,
    interventionsPerVisitorPerDay: perDay,
  },
});

const PAGE = { pageType: "product", productId: "SKU-1", variantId: "SKU-1-M" };

/**
 * What makes the plane intervene: a long dwell on the price block and a hand moving to the button.
 * Two events rather than one because the price barrier needs both to be confident enough.
 */
const wantsToBuy = (from: number, sessionId: string, visitorId = "vis_00000001") => ({
  events: [
    eventOf(from, {
      occurredAt: NOW,
      page: PAGE,
      sessionId,
      visitorId,
      type: "block_dwelled",
      block: "price",
      dwellMs: 6000,
    }),
    eventOf(from + 1, {
      occurredAt: NOW,
      page: PAGE,
      sessionId,
      visitorId,
      type: "cta_approached",
      approach: "hover",
    }),
  ],
});

/** The catalogue the evidence gate reads. It is durable in this deployment, so one put is enough. */
async function stock(platformKey: string): Promise<void> {
  const res = await putCatalog(
    app.app,
    { capturedAt: NOW, products: [catalogProductOf("SKU-1")] },
    { platformKey },
  );
  expect(res.statusCode).toBe(201);
}

const decide = async (key: string, batch: { events: unknown[] }) =>
  (json(await postEvents(app.app, batch, { key })) as IngestResult).decision;

describe("the caps survive the deploy (feature 032, US1)", () => {
  const A = withCaps("m_a", "key-a-1", "platform-a-1", 3);
  const B = withCaps("m_b", "key-b-1", "platform-b-1", 3);

  /** Closes what is running and boots on the same file: the restart, and also the first boot with caps. */
  const reboot = async (merchants: MerchantSpec[]): Promise<void> => {
    await app.close();
    app = await boot({ merchants });
  };

  it("a session that spent its budget is still spent after the restart", async () => {
    // The damage this feature exists to undo, in five lines: today the restart empties the hot state,
    // the session comes back looking untouched and the visitor is intervened a second time — which is
    // the one thing the budget exists to prevent, and it happened on **every** deploy.
    await reboot([A, B]);
    await stock("platform-a-1");
    expect((await decide("key-a-1", wantsToBuy(1, "ses_00000001"))).outcome).toBe("INTERVENE");
    expect(await decide("key-a-1", wantsToBuy(10, "ses_00000001"))).toMatchObject({
      outcome: "NO_OP",
      reason: "session-budget-exhausted",
    });

    await reboot([A, B]);

    // Nothing is in memory now. The budget holds because the session was rebuilt from the ledger.
    expect(await decide("key-a-1", wantsToBuy(20, "ses_00000001"))).toMatchObject({
      outcome: "NO_OP",
      reason: "session-budget-exhausted",
    });
  });

  it("a visitor who spent the quota of the day is still spent after the restart, across sessions", async () => {
    // The cap that crosses visits, and the only one that keeps a chain of deploys from having no
    // ceiling at all: without it, ten deploys in a day are ten quotas for the same person.
    const oncePerDay = withCaps("m_a", "key-a-1", "platform-a-1", 1);
    await reboot([oncePerDay, B]);
    await stock("platform-a-1");
    expect((await decide("key-a-1", wantsToBuy(1, "ses_00000001"))).outcome).toBe("INTERVENE");
    expect(await decide("key-a-1", wantsToBuy(10, "ses_00000002"))).toMatchObject({
      outcome: "NO_OP",
      reason: "visitor-fatigue",
    });

    await reboot([oncePerDay, B]);

    // A third session, so nothing about this answer can come from the budget of a session: it is the
    // visitor that is fatigued, rebuilt through the read by visitor the migration made possible.
    expect(await decide("key-a-1", wantsToBuy(20, "ses_00000003"))).toMatchObject({
      outcome: "NO_OP",
      reason: "visitor-fatigue",
    });
  });

  it("rebuilds each merchant from its own rows and reads nothing of the other", async () => {
    // Isolation across the restart, which is where a wrong index would break it: the reconstruction
    // reads by session and by visitor, and both keys start with the merchant. A query that forgot it
    // would let the spent budget of A fatigue the visitor of B — both use the same identifiers.
    await reboot([A, B]);
    await stock("platform-a-1");
    await stock("platform-b-1");
    expect((await decide("key-a-1", wantsToBuy(1, "ses_00000001"))).outcome).toBe("INTERVENE");

    await reboot([A, B]);

    // A is spent; B has the same session and visitor identifiers and has spent nothing.
    expect(await decide("key-a-1", wantsToBuy(10, "ses_00000001"))).toMatchObject({
      outcome: "NO_OP",
      reason: "session-budget-exhausted",
    });
    expect((await decide("key-b-1", wantsToBuy(20, "ses_00000001"))).outcome).toBe("INTERVENE");
    // And the other way round, so the isolation is not an accident of the order: B is spent now, and A
    // stays spent for its own reason rather than for the reason of B.
    expect(await decide("key-b-1", wantsToBuy(30, "ses_00000001"))).toMatchObject({
      outcome: "NO_OP",
      reason: "session-budget-exhausted",
    });
  });

  it("walks an index for each of the three reads the rebuild makes, on a table with rows", async () => {
    // A plan is asked of a table that **has rows**: SQLite plans an empty one differently, so the same
    // assertion against a fresh store would pass while saying nothing. Three reads, three indexes —
    // and a `SCAN` in any of them turns a rebuild on the decision path into a full table read.
    await reboot([A, B]);
    await stock("platform-a-1");
    for (let n = 0; n < 12; n += 1) {
      await decide("key-a-1", wantsToBuy(n * 2 + 1, `ses_0000000${n % 4}`, `vis_0000000${n % 3}`));
    }
    await reboot([A, B]);

    const store = app.resolve(SqlStorePort);
    const planOf = (sql: string, params: Record<string, string>): string =>
      store
        .all(`EXPLAIN QUERY PLAN ${sql}`, params)
        .map((row) => String(row["detail"]))
        .join(" | ");

    const bySession = planOf(
      "SELECT document FROM decisions WHERE merchant_id = :m AND session_id = :s ORDER BY id",
      { m: "m_a", s: "ses_00000001" },
    );
    const byVisitor = planOf(
      "SELECT document FROM decisions WHERE merchant_id = :m AND visitor_id = :v AND created_at >= :since ORDER BY created_at",
      { m: "m_a", v: "vis_00000001", since: NOW },
    );
    const events = planOf(
      "SELECT document FROM received_events WHERE merchant_id = :m AND session_id = :s ORDER BY id",
      { m: "m_a", s: "ses_00000001" },
    );

    expect(bySession).toContain("decisions_by_session");
    expect(byVisitor).toContain("decisions_by_visitor");
    expect(events).toContain("received_events_by_session");
    for (const plan of [bySession, byVisitor, events]) {
      expect(plan).not.toMatch(/\bSCAN\b/);
    }
  });
});
