// FR-053, SC-003: latencia de la ingesta medida por percentil sobre el perfil en memoria.
// Es una medición reportada, no un SLA: si CI resultara ruidoso, la política del plan es relajar
// la aserción y conservar el reporte (specs/004-protocolo-sdk-ingesta/plan.md).
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

describe("latencia de POST /v1/events (perfil en memoria)", () => {
  it(`p95 de ${BATCHES} lotes de ${EVENTS_PER_BATCH} eventos por debajo de ${P95_BUDGET_MS} ms`, async () => {
    // Calentamiento: JIT y primeras compilaciones de validadores no cuentan.
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
