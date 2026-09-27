// What the durable write costs on the critical path — the one question this feature leaves open
// (research R-01).
//
// `01 §P9` separates the two paths: decision synchronous and without network I/O, measurement
// asynchronous and durable. The decision plane **waits** for the record, because a ledger that
// cannot accept degrades the decision to `NO_OP` with a reason (ADR-021) — nothing enters the
// report without traceability (constitution IX), so "write and carry on" would allow intervening
// without having recorded. The write therefore stays on the critical path, and this measures it.
//
// **The two profiles are measured in the same run, on purpose.** An absolute figure from one
// machine says almost nothing; what decides whether decoupling rises in priority is the
// difference, and the difference is only meaningful when the machine, the JIT and the load are
// the same for both.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { durableDeployment } from "../../src/composition/deployments/durable.js";
import { localDeployment } from "../../src/composition/deployments/local.js";
import { replace } from "../../src/composition/graph/index.js";
import { ClockPort } from "../../src/composition/modules/shared-kernel.js";
import { batchOf, fixedClock, postEvents, startTestApp } from "../helpers/test-app.js";
import type { App } from "../../src/composition/bootstrap.js";

const BATCHES = 200;
const EVENTS_PER_BATCH = 20;

/**
 * The same budget the local profile is measured against (feature 004). `01 §4.6` proposes 150 ms
 * for the whole critical path and marks it a design goal, not an SLA, so there is room: what this
 * asserts is that the durable write did not change the order of magnitude, and what it reports is
 * the figure the decision is made on.
 */
const P95_BUDGET_MS = 50;

let dir: string;
let memory: App;
let durable: App;

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "ope-latency-"));
  const clock = [replace(ClockPort, fixedClock())];
  memory = await startTestApp({ deployment: localDeployment, ports: clock });
  durable = await startTestApp(
    { deployment: durableDeployment, ports: clock },
    { store: { file: path.join(dir, "ope.db") } },
  );
});

afterAll(async () => {
  await memory.close();
  await durable.close();
  rmSync(dir, { recursive: true, force: true });
});

function percentile(sorted: readonly number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? 0;
}

/** The percentiles of `BATCHES` ingests against one app, warm-up excluded. */
async function measure(app: App, from: number): Promise<{ p50: number; p95: number }> {
  for (let i = 0; i < 10; i += 1) {
    await postEvents(app.app, batchOf(EVENTS_PER_BATCH, from + i * EVENTS_PER_BATCH), { key: "key-a-1" });
  }
  const samples: number[] = [];
  for (let i = 0; i < BATCHES; i += 1) {
    const batch = batchOf(EVENTS_PER_BATCH, from + 1_000_000 + i * EVENTS_PER_BATCH);
    const start = performance.now();
    const response = await postEvents(app.app, batch, { key: "key-a-1" });
    samples.push(performance.now() - start);
    expect(response.statusCode).toBe(202);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  return { p50: percentile(sorted, 50), p95: percentile(sorted, 95) };
}

describe("what the durable write costs on the critical path", () => {
  it(`stays under ${P95_BUDGET_MS} ms and reports the difference against the in-memory profile`, async () => {
    const inMemory = await measure(memory, 1);
    const onDisk = await measure(durable, 10_000_000);

    console.info(
      [
        `ingest latency (${BATCHES} batches x ${EVENTS_PER_BATCH} events, inject):`,
        `memory p50=${inMemory.p50.toFixed(2)} ms p95=${inMemory.p95.toFixed(2)} ms |`,
        `sqlite p50=${onDisk.p50.toFixed(2)} ms p95=${onDisk.p95.toFixed(2)} ms |`,
        `delta p95=${(onDisk.p95 - inMemory.p95).toFixed(2)} ms`,
      ].join(" "),
    );

    expect(onDisk.p95).toBeLessThan(P95_BUDGET_MS);
  });
});
