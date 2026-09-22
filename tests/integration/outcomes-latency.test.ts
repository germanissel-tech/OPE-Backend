// Feature 013, SC-006: latency of POST /v1/orders measured by percentile on the local profile
// (memory ledgers). A reported measurement, not an SLA: outcomes are outside the critical
// decision path (constitution IV); the budget is the same as ingestion's.
import { performance } from "node:perf_hooks";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { replace } from "../../src/composition/graph/index.js";
import { ClockPort } from "../../src/composition/modules/shared-kernel.js";
import {
  batchOf,
  fixedClock,
  NOW,
  orderOf,
  postEvents,
  postOrder,
  startTestApp,
} from "../helpers/test-app.js";
import type { App } from "../../src/composition/bootstrap.js";

const ORDERS = 200;
const P95_BUDGET_MS = 50;

let app: App;
beforeAll(async () => {
  app = await startTestApp({ ports: [replace(ClockPort, fixedClock())] });
  // A known session, so every order goes through the correlation.
  await postEvents(app.app, batchOf(5, 1), { key: "key-a-1" });
});
afterAll(async () => {
  await app.close();
});

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? 0;
}

describe("latency of POST /v1/orders (local profile)", () => {
  it(`p95 of ${ORDERS} attributed orders under ${P95_BUDGET_MS} ms`, async () => {
    for (let i = 0; i < 10; i += 1) {
      await postOrder(app.app, orderOf(`W-${i}`, { sessionId: "ses_00000001" }), {
        platformKey: "platform-a-1",
      });
    }
    const samples: number[] = [];
    for (let i = 0; i < ORDERS; i += 1) {
      const body = orderOf(`O-${i}`, { sessionId: "ses_00000001", confirmedAt: NOW });
      const start = performance.now();
      const res = await postOrder(app.app, body, { platformKey: "platform-a-1" });
      samples.push(performance.now() - start);
      expect(res.statusCode).toBe(201);
    }
    const sorted = [...samples].sort((a, b) => a - b);
    const p50 = percentile(sorted, 50);
    const p95 = percentile(sorted, 95);
    console.info(
      `orders latency (${ORDERS} notifications, inject): p50=${p50.toFixed(2)} ms, p95=${p95.toFixed(2)} ms, max=${(sorted.at(-1) ?? 0).toFixed(2)} ms`,
    );
    expect(p95).toBeLessThan(P95_BUDGET_MS);
  });
});
