// What the reconstruction costs on the critical path (feature 032, SC-005) — the question this feature
// leaves open, and the one it cannot answer with a budget.
//
// **There is no declared budget here, and that is the honest state of it.** A budget needs a baseline to
// compare against and there is none: nobody has run this system against a pilot, and the number below
// comes from SQLite on one laptop with no network — which is, precisely, **not the case that matters**
// (**D-21**). So the test publishes the figure and asserts only what is worth asserting on this machine:
// the same order of magnitude.
//
// **Making the two halves comparable took more than it looks, and the first version was wrong.** It ran
// one sweep right after a restart (every session rebuilding) and a second sweep immediately after (the
// same sessions now in memory), and reported the difference. The difference came out **negative** — the
// rebuild looked faster — which is not a result, it is a broken measurement: by the second sweep each
// session carried one more batch of accumulated signals, so that sweep was doing strictly more work in
// the part that has nothing to do with storage.
//
// What it does instead:
//
//   - two groups of sessions, and the one that will be measured **from memory** is seeded with one batch
//     **fewer**, because it needs a request after the restart to get into memory and that request adds
//     the batch back. At the moment of measurement both groups carry the same history.
//   - the two are measured **interleaved**, one session of each in turn, so a store that grows and a
//     garbage collector that runs affect both the same way.
//
// **What it measured, over four runs on this machine (2026-09-28).** The p50 of a decision that rebuilds
// came out +0.61, +0.55, +0.78 and +0.03 ms above one that does not, and the p95 difference swung between
// -7.9 and +2.1 ms. So: **under a millisecond where it is visible at all, and at p95 indistinguishable
// from noise**. The two extra indexed reads sit below the measurement floor of the rest of the request.
// That is the finding, and it is not a budget: one laptop, SQLite, no network.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { durableDeployment } from "../../src/composition/deployments/durable.js";
import { replace } from "../../src/composition/graph/index.js";
import { EventLogQueuePort } from "../../src/composition/modules/ingestion.js";
import { ClockPort } from "../../src/composition/modules/shared-kernel.js";
import {
  NOW,
  eventOf,
  fixedClock,
  postEvents,
  startTestApp,
  type MerchantSpec,
} from "../helpers/test-app.js";
import type { App } from "../../src/composition/bootstrap.js";

/** Enough sessions per group for a p95 that means something, and few enough that the suite stays one. */
const SESSIONS = 120;
/** How much history each session carries when it is measured: what a rebuild has to read back. */
const HISTORY = 3;

/**
 * The same budget the two latency tests before this one are measured against (features 004 and 031).
 * `01 §4.6` proposes 150 ms for the whole critical path and calls it a design goal rather than an SLA,
 * so what this asserts is that rebuilding did not change the order of magnitude — not that the number
 * is right, which this machine cannot say.
 */
const P95_BUDGET_MS = 50;

/** A budget high enough that no request is refused for a reason that has nothing to do with latency. */
const MERCHANT: MerchantSpec = {
  merchantId: "m_a",
  ingestKeys: ["key-a-1"],
  origins: ["https://a.example"],
  evidenceProfile: { returnsPolicy: true, fitData: true },
  declared: { holdoutShare: 0 },
  experiments: [],
  commercialPolicy: { version: "a-latency", interventionsPerSession: 100, cooldownSeconds: 0 },
};

let dir: string;
let file: string;
let app: App;

const boot = async (): Promise<App> =>
  startTestApp(
    { deployment: durableDeployment, ports: [replace(ClockPort, fixedClock())] },
    { store: { file }, merchants: [MERCHANT] },
  );

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "ope-rebuild-latency-"));
  file = path.join(dir, "ope.db");
  app = await boot();
});

afterAll(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

function percentile(sorted: readonly number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? 0;
}

const percentilesOf = (samples: readonly number[]): { p50: number; p95: number } => {
  const sorted = [...samples].sort((a, b) => a - b);
  return { p50: percentile(sorted, 50), p95: percentile(sorted, 95) };
};

/** The two groups, in disjoint ranges of session identifier so neither can see the other's state. */
const rebuilt = (n: number): string => `ses_r${String(n).padStart(7, "0")}`;
const warm = (n: number): string => `ses_w${String(n).padStart(7, "0")}`;

/** One batch of two events in the session, with event ids that never repeat across the run. */
const batch = (sessionId: string, from: number) => {
  const page = { pageType: "product", productId: "SKU-1", variantId: "SKU-1-M" };
  return {
    events: [
      eventOf(from, {
        occurredAt: NOW,
        sessionId,
        page,
        type: "block_dwelled",
        block: "price",
        dwellMs: 6000,
      }),
      eventOf(from + 1, { occurredAt: NOW, sessionId, page, type: "cta_approached", approach: "hover" }),
    ],
  };
};

const send = async (sessionId: string, from: number): Promise<void> => {
  const response = await postEvents(app.app, batch(sessionId, from), { key: "key-a-1" });
  expect(response.statusCode).toBe(202);
};

/** One request, timed. */
async function timed(sessionId: string, from: number): Promise<number> {
  const start = performance.now();
  await send(sessionId, from);
  return performance.now() - start;
}

describe("what the reconstruction costs on the critical path (SC-005)", () => {
  it(`stays under ${P95_BUDGET_MS} ms and reports what rebuilding adds`, async () => {
    // The group that will be measured rebuilding gets its whole history now; the one that will be
    // measured from memory gets one batch fewer, because the request that warms it after the restart is
    // the batch it is missing.
    for (let round = 0; round < HISTORY; round += 1) {
      for (let n = 0; n < SESSIONS; n += 1) {
        await send(rebuilt(n), 1 + round * 100_000 + n * 10);
        if (round < HISTORY - 1) await send(warm(n), 50_001 + round * 100_000 + n * 10);
      }
    }
    // The register writes from a queue, so without this the rebuild would read rows that real time would
    // already have written — and the figure would be of a cheaper read than the real one.
    app.resolve(EventLogQueuePort).flush();

    await app.close();
    app = await boot();

    // Warming: this request rebuilds too, so it is not timed. After it, both groups carry `HISTORY`
    // batches and only this one is in memory.
    for (let n = 0; n < SESSIONS; n += 1) await send(warm(n), 500_001 + n * 10);

    const rebuilding: number[] = [];
    const fromMemory: number[] = [];
    for (let n = 0; n < SESSIONS; n += 1) {
      rebuilding.push(await timed(rebuilt(n), 1_000_001 + n * 10));
      fromMemory.push(await timed(warm(n), 1_500_001 + n * 10));
    }

    const cold = percentilesOf(rebuilding);
    const hot = percentilesOf(fromMemory);
    console.info(
      [
        `rebuild latency (${SESSIONS} sessions per group x ${HISTORY} batches of history, inject):`,
        `rebuilt p50=${cold.p50.toFixed(2)} ms p95=${cold.p95.toFixed(2)} ms |`,
        `from memory p50=${hot.p50.toFixed(2)} ms p95=${hot.p95.toFixed(2)} ms |`,
        `delta p50=${(cold.p50 - hot.p50).toFixed(2)} ms p95=${(cold.p95 - hot.p95).toFixed(2)} ms`,
      ].join(" "),
    );

    expect(cold.p95).toBeLessThan(P95_BUDGET_MS);
  });
});
