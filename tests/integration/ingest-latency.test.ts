// FR-053, SC-003: ingestion latency measured by percentile on the local profile (memory ledgers).
// It is a reported measurement, not an SLA: if CI turns out noisy, the plan's policy is to relax
// the assertion and keep the report (specs/004-protocolo-sdk-ingesta/plan.md).
import { performance } from "node:perf_hooks";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { batchOf, postEvents, startTestApp } from "../helpers/test-app.js";
import type { App } from "../../src/composition/bootstrap.js";

const BATCHES = 200;
const EVENTS_PER_BATCH = 20;
const P95_BUDGET_MS = 50;

let app: App;
beforeAll(async () => {
  app = await startTestApp();
});
afterAll(async () => {
  await app.close();
});

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? 0;
}

describe("latency of POST /v1/events (local profile)", () => {
  it(`p95 of ${BATCHES} batches of ${EVENTS_PER_BATCH} events under ${P95_BUDGET_MS} ms`, async () => {
    // Warm-up: JIT and first validator compilations do not count.
    for (let i = 0; i < 10; i += 1) {
      await postEvents(app.app, batchOf(EVENTS_PER_BATCH, 1_000_000 + i * EVENTS_PER_BATCH), {
        key: "key-a-1",
      });
    }
    const samples: number[] = [];
    for (let i = 0; i < BATCHES; i += 1) {
      const batch = batchOf(EVENTS_PER_BATCH, 1 + i * EVENTS_PER_BATCH);
      const start = performance.now();
      const res = await postEvents(app.app, batch, { key: "key-a-1" });
      samples.push(performance.now() - start);
      expect(res.statusCode).toBe(202);
    }
    const sorted = [...samples].sort((a, b) => a - b);
    const p50 = percentile(sorted, 50);
    const p95 = percentile(sorted, 95);
    console.info(
      `latencia ingesta (${BATCHES} lotes × ${EVENTS_PER_BATCH} eventos, inject): p50=${p50.toFixed(2)} ms, p95=${p95.toFixed(2)} ms, max=${(sorted.at(-1) ?? 0).toFixed(2)} ms`,
    );
    expect(p95).toBeLessThan(P95_BUDGET_MS);
  });
});
