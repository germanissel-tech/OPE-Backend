// What an administration action costs a decision that is happening at the same time (feature 034,
// SC-002, SC-003 and SC-004). **This is the condition of acceptance of the feature**, not a metric.
//
// The mechanism of feature 034 does something the repository had never done: it makes the decision path
// **wait**. A unit of work holds the store for the length of one administration write, and every durable
// gateway now asks for its turn before touching it. An administration action lasts one local write, so
// the wait should be invisible — and "should" is exactly what a milestone does not accept.
//
// **The three questions are one run on purpose.** An absolute figure from one machine says almost
// nothing; what says something is the difference between two windows measured minutes apart on the same
// heap, with the same JIT and the same load. The quiet window is the control.
//
// What each one is:
//
//   - **SC-002**: the p95 of the ingest with administration actions running against the p95 without them.
//   - **SC-003**: every arrival the API accepted is in the register afterwards. The queue skips a flush
//     while somebody else's unit is open, so this is what says it **held** them rather than dropped them.
//   - **SC-004**: no decision came back degraded for want of a store, in a run where the store never
//     failed. A decision that waited is a decision; one that degraded is a regression of ADR-021.
//
// **Three windows and not two, and the middle one is what makes the number mean something.** A greedy
// loop of requests costs the ingest whatever a second stream of work costs on one event loop, and that is
// not what this feature changed. So the load runs twice: once as administration **reads**, which go to the
// same store through the same borders and open no unit, and once as administration **writes**, which do.
// Quiet against reads is the price of the company; reads against writes is the price of the **turn**, and
// that is the only figure SC-002 is about.
//
// **What it measured on this machine, over three runs (2026-09-29).** The turn came out 3.78, 4.85 and
// 3.96 ms — about the length of one administration write, which is what the mechanism claims and the
// ceiling below is ten times over. The company came out 4.29, 4.83 and 2.84 ms in the same runs, which is
// the number that would have been mistaken for the turn without the middle window. One laptop, SQLite, no
// network (**D-21**).
//
// It is **excluded from the mutation suite** for the same reason as the other two measuring files
// (`vitest.mutation.config.ts`): it costs seconds per mutant and kills nothing that the unit test of the
// queue does not kill in milliseconds.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { durableDeployment } from "../../src/composition/deployments/durable.js";
import { replace } from "../../src/composition/graph/index.js";
import { EventLogPort, EventLogQueuePort } from "../../src/composition/modules/ingestion.js";
import { ClockPort } from "../../src/composition/modules/shared-kernel.js";
import { asMerchantId, asSessionId } from "../../src/domain/shared-kernel/index.js";
import { json } from "../helpers/json.js";
import { admin, batchOf, fixedClock, postEvents, startTestApp } from "../helpers/test-app.js";
import type { components } from "#generated/api.js";
import type { App } from "../../src/composition/bootstrap.js";

type IngestResult = components["schemas"]["IngestResult"];

const A = asMerchantId("m_a");
const SESSION = asSessionId("ses_00000001");
const KEY = "key-a-1";

/** Batches per window and events per batch: enough for a p95 to mean something, few enough to be a test. */
const BATCHES = 120;
const EVENTS_PER_BATCH = 10;
/** Ingests before the samples, so what is measured is a warm process and not the first compile. */
const WARM_UP = 10;

/**
 * The same budget the other latency files assert (`01 §4.6` proposes 150 ms for the whole critical path
 * as a design goal, not an SLA). It is the floor: what this feature is accepted on is the delta below.
 */
const P95_BUDGET_MS = 50;

/**
 * How much worse the p95 may get with administration actions running.
 *
 * **Ten milliseconds is not a measurement, it is a ceiling, and it is here because of what it excludes.**
 * An administration action is one local write of a few rows: if the ingest ends up waiting for a whole
 * one, the delta is a millisecond or two. What ten milliseconds rules out is the shape of failure this
 * mechanism could have — a turn that is handed out late, a queue that retries in a storm, a unit that
 * stays open past its work — and any of those costs far more than ten. A tighter number would only make
 * the test flaky on a busy laptop, which is a worse trade than the one it would catch.
 */
const DELTA_BUDGET_MS = 10;

let dir: string;
let file: string;
let app: App;

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "ope-admin-concurrency-"));
  file = path.join(dir, "ope.db");
  app = await startTestApp(
    { deployment: durableDeployment, ports: [replace(ClockPort, fixedClock())] },
    { store: { file } },
  );
});

afterEach(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

function percentile(sorted: readonly number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? 0;
}

interface Window {
  readonly p50: number;
  readonly p95: number;
  /** Everything the API said it took in, which is what the register has to hold afterwards (SC-003). */
  readonly accepted: number;
  /** The reason of every decision of the window, so the degraded ones can be counted (SC-004). */
  readonly reasons: readonly string[];
}

/**
 * One window of ingest: `WARM_UP` batches that are not measured and `BATCHES` that are.
 *
 * `from` is where the event ids start, and each window gets its own range so nothing is a duplicate —
 * a duplicate is not recorded twice, and an arrival that was never written and one that was written
 * before would then be indistinguishable in the count.
 */
async function ingestWindow(from: number): Promise<Window> {
  let accepted = 0;
  const reasons: string[] = [];
  const samples: number[] = [];
  const send = async (at: number, measured: boolean): Promise<void> => {
    const start = performance.now();
    const response = await postEvents(app.app, batchOf(EVENTS_PER_BATCH, at), { key: KEY });
    const elapsed = performance.now() - start;
    expect(response.statusCode).toBe(202);
    const body = json(response) as IngestResult;
    accepted += body.accepted;
    reasons.push(body.decision.reason);
    if (measured) samples.push(elapsed);
  };
  for (let i = 0; i < WARM_UP; i += 1) await send(from + i * EVENTS_PER_BATCH, false);
  const measuredFrom = from + WARM_UP * EVENTS_PER_BATCH;
  for (let i = 0; i < BATCHES; i += 1) await send(measuredFrom + i * EVENTS_PER_BATCH, true);
  const sorted = [...samples].sort((a, b) => a - b);
  return { p50: percentile(sorted, 50), p95: percentile(sorted, 95), accepted, reasons };
}

/**
 * How often an administration request is issued while a window is being measured.
 *
 * **Paced and not as fast as it answers, and both reasons are findings of writing this file.** The first
 * version drove each loop flat out, and that is not the load SC-002 describes —an operator acting, not a
 * saturated store— so what it measured was the saturation. It also could not run: a tight loop of
 * requests exhausts a four-gigabyte heap after tens of thousands of them, and that has nothing to do with
 * this feature — it reproduces with a request for a route that does not exist, which opens no unit,
 * touches no store and reaches no gateway. Paced at four milliseconds, a window of a second and a half
 * still meets a few hundred actions, which is contention enough for the question.
 */
const ACTION_EVERY_MS = 4;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A request issued every `ACTION_EVERY_MS`, until the returned `stop` is called, answering how many got
 * through. A status that is not the expected one throws, which `stop` surfaces as the failure it is.
 *
 * **Never touching the merchant being measured**, which is the only way the comparison stays about the
 * store: a kill switch or a configuration of `m_a` would change what its decisions *say*, and then the
 * windows would differ for a reason that has nothing to do with waiting.
 */
function driveContinuously(
  request: (nth: number) => Promise<{ statusCode: number }>,
  expected: number,
): { stop: () => Promise<number> } {
  // A field and not a `let`: the compiler narrows a local assigned `true` here to the literal, and then
  // the loop condition is "always truthy" although the caller is what changes it.
  const load = { running: true };
  let done = 0;
  const loop = (async () => {
    while (load.running) {
      const response = await request(done);
      if (response.statusCode !== expected) {
        throw new Error(`the administration load got ${response.statusCode}, not ${expected}`);
      }
      done += 1;
      await sleep(ACTION_EVERY_MS);
    }
    return done;
  })();
  return {
    stop: async () => {
      load.running = false;
      return loop;
    },
  };
}

/**
 * The action: a row of another merchant rewritten and its audit entry, **inside one unit of work**. That
 * unit is what the ingest has to wait for, and it is the whole subject of the measurement.
 *
 * **It is a kill switch and not a merchant being created, and the first version of this file was the
 * second.** Creating one is the same unit of work and it accumulates: every new merchant stays in the
 * in-memory index that resolves the credential of **every** request (ADR-041), so the ingest got slower,
 * a slower window let the loop create more, and the run ate four gigabytes before it proved anything. An
 * unbounded loop of an accumulating action does not measure contention — it measures the accumulation.
 */
const togglingTheKillSwitch = () =>
  driveContinuously(
    (nth) =>
      admin(app.app, "PUT", "/v1/admin/merchants/m_b/kill-switch", { body: { enabled: nth % 2 === 0 } }),
    200,
  );

/**
 * The control: an administration **read**, which goes to the same store through the same HTTP borders and
 * opens **no unit of work**.
 *
 * Without it the measurement cannot answer the question it is for. A greedy loop of requests costs the
 * ingest whatever a second stream of work costs on one event loop, and that is not what this feature
 * changed — what it changed is that a unit makes a gateway wait. Quiet against reads is the price of the
 * company; reads against writes is the price of the **turn**, and that is the number SC-002 is about.
 */
const readingTheLog = () => driveContinuously(() => admin(app.app, "GET", "/v1/admin/log?limit=50"), 200);

/** What the register holds for the session every batch of this file belongs to. */
async function registered(): Promise<number> {
  // Drained first: the queue writes on an interval, and what is pending is not a loss (FR-007).
  app.resolve(EventLogQueuePort).flush();
  return (await app.resolve(EventLogPort).bySession(A, SESSION)).length;
}

describe("what an administration action costs a concurrent decision", () => {
  it("costs the ingest no more than the ceiling, loses no arrival and degrades no decision", async () => {
    // Three windows, in this order and in one process: the control, the company, and the turn.
    const quiet = await ingestWindow(1);

    const reading = readingTheLog();
    const underReads = await ingestWindow(1_000_000);
    const reads = await reading.stop();

    const writing = togglingTheKillSwitch();
    const underWrites = await ingestWindow(2_000_000);
    const writes = await writing.stop();

    // **The delta of the feature is writes against reads and not against quiet.** The two loops are
    // equally greedy, so what is left between them is the unit of work.
    const turn = underWrites.p95 - underReads.p95;
    const company = underReads.p95 - quiet.p95;
    const line = (what: string, w: Window): string =>
      `${what} p50=${w.p50.toFixed(2)} ms p95=${w.p95.toFixed(2)} ms`;
    console.info(
      [
        `admin concurrency (${BATCHES} batches x ${EVENTS_PER_BATCH} events per window):`,
        `${line("quiet", quiet)} |`,
        `${line(`under ${reads} reads`, underReads)} |`,
        `${line(`under ${writes} actions`, underWrites)} |`,
        `company p95=${company.toFixed(2)} ms | turn p95=${turn.toFixed(2)} ms`,
      ].join(" "),
    );

    // Both loops have to have run, or the comparison is between windows that measured the same thing.
    expect(reads).toBeGreaterThan(0);
    expect(writes).toBeGreaterThan(0);

    // **SC-002**: the same order of magnitude, and what the unit of work costs under its ceiling.
    expect(underWrites.p95).toBeLessThan(P95_BUDGET_MS);
    expect(turn).toBeLessThan(DELTA_BUDGET_MS);

    // **SC-003**: every arrival of the three windows is in the register. The queue skipped the flushes
    // that fell inside a unit, so this is what says it kept them instead of dropping them.
    expect(await registered()).toBe(quiet.accepted + underReads.accepted + underWrites.accepted);

    // **SC-004**: nothing degraded for want of a store in a run where the store never failed. Asked of
    // every reason rather than of a list of slugs: every reason of the catalogue that means "the store did
    // not answer" ends the same way, and a new one would be caught by this too.
    const degraded = (w: Window): string[] => w.reasons.filter((reason) => reason.endsWith("-unavailable"));
    expect(degraded(underWrites)).toEqual([]);
    expect(degraded(underReads)).toEqual([]);
    expect(degraded(quiet)).toEqual([]);
  });
});
