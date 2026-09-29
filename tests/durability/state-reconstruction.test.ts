// A session that comes back comes back as it was (feature 032, US2). Where the restart suite is about
// the **caps** — a budget that has to stay spent — this one is about the **signals**: what the plane
// inferred from the behaviour of a visit has to survive the visit leaving memory, or the decision after
// an eviction is a different decision than the one that would have been taken without it.
//
// The way it is proved is the only way that means anything: **the same sequence of events is run twice,
// once with a restart in the middle and once without**, and the two decisions are compared. Asserting
// only the run with the restart would leave the interesting half unstated — that the answer is not
// merely reasonable but *the same one*.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { durableDeployment } from "../../src/composition/deployments/durable.js";
import { replace } from "../../src/composition/graph/index.js";
import { SessionStatePort } from "../../src/composition/modules/decision.js";
import { EventLogQueuePort } from "../../src/composition/modules/ingestion.js";
import { ClockPort } from "../../src/composition/modules/shared-kernel.js";
import { asMerchantId, asSessionId, minutes } from "../../src/domain/shared-kernel/index.js";
import { json } from "../helpers/json.js";
import { stateOf } from "../helpers/state.js";
import {
  NOW,
  catalogProductOf,
  eventOf,
  fixedClock,
  postEvents,
  putCatalog,
  startTestApp,
  type MerchantSpec,
} from "../helpers/test-app.js";
import type { components } from "#generated/api.js";
import type { App } from "../../src/composition/bootstrap.js";

type IngestResult = components["schemas"]["IngestResult"];
type Decision = IngestResult["decision"];

/**
 * One merchant, everyone in treatment, and a budget of three per session so the interesting batch is
 * not refused for a reason that has nothing to do with the signals.
 */
const MERCHANT: MerchantSpec = {
  merchantId: "m_a",
  ingestKeys: ["key-a-1"],
  platformKeys: ["platform-a-1"],
  origins: ["https://a.example"],
  evidenceProfile: { returnsPolicy: true, fitData: true },
  declared: { holdoutShare: 0 },
  experiments: [
    {
      experimentId: "exp_a_000001",
      treatmentShare: 1,
      seed: "seed-a",
      status: "active",
      openedAt: "2026-09-17T00:00:00Z",
    },
  ],
  commercialPolicy: { version: "a-rebuild", interventionsPerSession: 3, cooldownSeconds: 0 },
};

const PAGE = { pageType: "product", productId: "SKU-1", variantId: "SKU-1-M" };

let dir: string;
let file: string;
let app: App;

async function boot(): Promise<App> {
  return startTestApp(
    { deployment: durableDeployment, ports: [replace(ClockPort, fixedClock())] },
    { store: { file }, merchants: [MERCHANT] },
  );
}

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "ope-rebuild-"));
  file = path.join(dir, "ope.db");
  app = await boot();
  const catalogue = await putCatalog(
    app.app,
    { capturedAt: NOW, products: [catalogProductOf("SKU-1")] },
    { platformKey: "platform-a-1" },
  );
  expect(catalogue.statusCode).toBe(201);
});

afterEach(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

const send = async (batch: { events: unknown[] }): Promise<Decision> =>
  (json(await postEvents(app.app, batch, { key: "key-a-1" })) as IngestResult).decision;

/** One event of the given kind in `sessionId`, with a unique id. */
const event = (n: number, sessionId: string, over: Record<string, unknown>) =>
  eventOf(n, { occurredAt: NOW, page: PAGE, sessionId, ...over });

/**
 * The visit, as three batches, and **what makes the barrier fire is split across two of them**. That is
 * the whole design of this test and the first version got it wrong: with the price dwell and the move to
 * the button in the *same* last batch, that batch was enough on its own, the accumulated signals never
 * mattered, and the test passed with the reconstruction switched off.
 *
 * Now the dwell on the price is in `reads` and only the hand moving to the button is in `hesitates`.
 * The last batch cannot decide anything by itself; it can only decide together with what the session
 * already held — which is exactly the thing that has to survive leaving memory.
 */
const visit = (from: number, sessionId: string) => ({
  arrives: { events: [event(from, sessionId, { type: "product_viewed" })] },
  reads: {
    events: [event(from + 1, sessionId, { type: "block_dwelled", block: "price", dwellMs: 6000 })],
  },
  hesitates: {
    events: [event(from + 2, sessionId, { type: "cta_approached", approach: "hover" })],
  },
});

describe("a session that comes back comes back as it was (feature 032, US2)", () => {
  it("decides the same after an eviction as it would have without one", async () => {
    // Two visits of the same shape, in two sessions so neither can see the other's state. The first
    // runs straight through; the second is interrupted by a restart right before its last batch, which
    // is the batch whose decision is being compared.
    const straight = visit(1, "ses_00000001");
    const interrupted = visit(20, "ses_00000002");

    await send(straight.arrives);
    await send(straight.reads);
    const withoutRestart = await send(straight.hesitates);

    await send(interrupted.arrives);
    await send(interrupted.reads);
    await app.close();
    app = await boot();
    const withRestart = await send(interrupted.hesitates);

    // The same verdict, for the same reason, with the same text. Not "an intervention too": the point
    // of SC-002 is that the eviction is **invisible** in the answer.
    expect(withRestart.outcome).toBe(withoutRestart.outcome);
    expect(withRestart.reason).toBe(withoutRestart.reason);
    expect(withRestart.intervention?.messageVersionId).toBe(withoutRestart.intervention?.messageVersionId);
    expect(withRestart.intervention?.anchor).toBe(withoutRestart.intervention?.anchor);
    // And it is an intervention, so the comparison is between two real decisions and not between two
    // identical refusals — which would compare equal while proving nothing.
    expect(withoutRestart.outcome).toBe("INTERVENE");
  });

  it("treats a session nothing is known of as a new one, not as a failure", async () => {
    // The most common case by far, and the one the third answer of the ports had to be careful not to
    // swallow: a first batch finds nothing in memory and nothing durable, and that is a new visit.
    // If the rebuild reported that as `state-unavailable`, every first batch of every visit would
    // degrade — which is why this is asserted rather than assumed.
    await app.close();
    app = await boot();

    const first = await send(visit(40, "ses_00000009").arrives);
    expect(first.reason).not.toBe("state-unavailable");
    // A product view alone says nothing about a barrier yet, which is the honest answer for a visit
    // that has just started.
    expect(first).toMatchObject({ outcome: "NO_OP", reason: "barrier-unclear" });
  });

  describe("what leaves memory and what is over are two different things (US3, FR-003)", () => {
    // **This is what splitting `sessionWindowMs` bought, and the only place it is visible as
    // behaviour.** One field used to hold both numbers, so they could not disagree; now they can, and
    // the two cases below are the same visit with the same retention, told apart only by how much time
    // passed:
    //
    //   - past the **retention** but inside the **duration** → out of memory, rebuilt, same decision;
    //   - past the **duration** → another visit, not rebuilt, and the SDK owed it a new `sessionId`.
    //
    // The retention is five minutes here and the duration is the thirty of the release, so the first
    // case exists at all. With one field it could not have.
    const RETENTION_MS = minutes(5);

    /** The clock this describe advances. A restart would empty memory too — an eviction must not. */
    let instant: Date;
    const moving = { now: () => instant };

    const withRetention = async (): Promise<void> => {
      await app.close();
      instant = new Date(NOW);
      app = await startTestApp(
        { deployment: durableDeployment, ports: [replace(ClockPort, moving)] },
        { store: { file }, merchants: [MERCHANT], stateRetention: { sessionMs: RETENTION_MS } },
      );
      // No catalogue is put again: it is durable in this deployment, so the one the setup published is
      // still on the file. Putting it twice would answer 200 and not 201 — the snapshot is idempotent
      // on its capturedAt — which is how this was found.
    };

    /**
     * Time passing, in the two dimensions the test has to move together.
     *
     * The clock is the obvious one. The other is the **register**, whose write is queued and flushed on
     * an interval (feature 031, FR-007): a fake clock can make a session go quiet but cannot make that
     * interval fire, so without this the rebuild would read a register that real time would already have
     * written. Found by this test failing with `barrier-unclear` — the session came back with no signals
     * because none of them had reached the file yet.
     *
     * **And it names a real property of the system, not only of the test.** The caps are exact, because
     * the ledger write is synchronous; the signals are best-effort, because the register write is not. In
     * production the gap is the flush interval against a retention of a day, but it is a gap, and it is
     * the same asymmetry the answer of Q1 rests on.
     */
    const advance = (ms: number): void => {
      instant = new Date(Date.parse(NOW) + ms);
      app.resolve(EventLogQueuePort).flush();
    };

    const sessionInMemory = async (sessionId: string) =>
      stateOf(await app.resolve(SessionStatePort).load(asMerchantId("m_a"), asSessionId(sessionId)));

    it("rebuilds a session that left memory but is still within its duration", async () => {
      await withRetention();
      const quiet = visit(60, "ses_00000011");
      await send(quiet.arrives);
      await send(quiet.reads);
      // In memory while it is active, which is the half of US3 that a single assertion would miss: if
      // it were never there, "it left" would say nothing.
      expect(await sessionInMemory("ses_00000011")).toBeDefined();

      advance(minutes(10));

      // Gone from memory — ten minutes of quiet against a retention of five.
      expect(await sessionInMemory("ses_00000011")).toBeUndefined();
      // And the decision is the one it would have been: what left is memory, not a rule of business.
      expect((await send(quiet.hesitates)).outcome).toBe("INTERVENE");
    });

    it("does not rebuild the same session once its duration has passed", async () => {
      await withRetention();
      const quiet = visit(80, "ses_00000012");
      await send(quiet.arrives);
      await send(quiet.reads);

      advance(minutes(31));

      // Past the thirty minutes the release publishes: this is another visit, and the signals of the
      // one before it are deliberately not carried over — so the batch that would have decided with
      // them decides without them.
      expect(await sessionInMemory("ses_00000012")).toBeUndefined();
      expect(await send(quiet.hesitates)).toMatchObject({ outcome: "NO_OP" });
    });
  });
});
