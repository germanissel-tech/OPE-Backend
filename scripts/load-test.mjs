// test:load — informative load test of the ingestion against the built server (FR-040, FR-041;
// 01-arquitectura-mvp.md §4.6: a design target, not an SLA). Never fails on the figures.
//
//   npm run build && npm run test:load
//   OPE_LOAD_DURATION=10 OPE_LOAD_CONNECTIONS=50 OPE_LOAD_VISITORS=1000 npm run test:load
//
// Prints one stable line: `load: <batches/s> batches/s, p50 <ms>, p90 <ms>, p97.5 <ms>, p99 <ms>, errors <n>,
// non2xx <n> (<s> s, <c> connections)`; exit 0 unless the server does not start.
import autocannon from "autocannon";
import { startBuiltServer } from "./server-lib.mjs";

const DEFAULT_DURATION_S = 30;
const DEFAULT_CONNECTIONS = 20;
const DEFAULT_VISITORS = 1000;
const EVENTS_PER_BATCH = 20;
const ID_WIDTH = 8;

const LOAD_MERCHANT = {
  merchantId: "load-test-merchant",
  ingestKeys: ["ope_load_test_key"],
  origins: ["http://127.0.0.1"],
  experiments: [
    {
      experimentId: "exp_load_00001",
      treatmentPercent: 50,
      seed: "load-seed",
      status: "active",
      openedAt: "2026-09-17T00:00:00Z",
    },
  ],
};

/**
 * @param {string} name
 * @param {number} fallback
 * @returns {number}
 */
function integerEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0)
    throw new Error(`${name} must be a positive integer, got "${raw}"`);
  return value;
}

/** Twenty valid events of one session, with ids unique across the whole run. */
/**
 * @param {number} batchIndex
 * @param {number} visitors
 * @returns {string}
 */
function batchBody(batchIndex, visitors) {
  const visitor = `vis_${String(batchIndex % visitors).padStart(ID_WIDTH, "0")}`;
  const session = `ses_${String(batchIndex).padStart(ID_WIDTH, "0")}`;
  const occurredAt = new Date().toISOString();
  const events = Array.from({ length: EVENTS_PER_BATCH }, (_, i) => ({
    type: "product_viewed",
    eventId: `evt_${String(batchIndex * EVENTS_PER_BATCH + i).padStart(ID_WIDTH, "0")}`,
    sessionId: session,
    visitorId: visitor,
    occurredAt,
    page: { pageType: "product", productId: "SKU-LOAD" },
    device: "mobile",
  }));
  return JSON.stringify({ events });
}

/** @returns {Promise<number>} */
async function main() {
  const duration = integerEnv("OPE_LOAD_DURATION", DEFAULT_DURATION_S);
  const connections = integerEnv("OPE_LOAD_CONNECTIONS", DEFAULT_CONNECTIONS);
  const visitors = integerEnv("OPE_LOAD_VISITORS", DEFAULT_VISITORS);
  const server = await startBuiltServer({ OPE_MERCHANTS: JSON.stringify([LOAD_MERCHANT]) });
  try {
    let batchIndex = 0;
    const result = await autocannon({
      url: `${server.base}/v1/events`,
      method: "POST",
      connections,
      duration,
      headers: {
        "content-type": "application/json",
        "x-ope-ingest-key": LOAD_MERCHANT.ingestKeys[0] ?? "",
      },
      setupClient: (client) => {
        client.setBody(batchBody(batchIndex, visitors));
        client.on("response", () => {
          batchIndex += 1;
          client.setBody(batchBody(batchIndex, visitors));
        });
      },
    });
    // autocannon's histogram exposes p90 and p97.5 (not p95): the stricter one is reported.
    const line = [
      `load: ${result.requests.average.toFixed(1)} batches/s`,
      `p50 ${result.latency.p50} ms`,
      `p90 ${result.latency.p90} ms`,
      `p97.5 ${result.latency.p97_5} ms`,
      `p99 ${result.latency.p99} ms`,
      `errors ${result.errors}`,
      `non2xx ${result.non2xx}`,
    ].join(", ");
    console.log(`${line} (${duration} s, ${connections} connections, ${visitors} visitors)`);
    return 0;
  } finally {
    await server.stop();
  }
}

main()
  .then((code) => process.exit(code))
  .catch((/** @type {unknown} */ err) => {
    console.error(`test:load — ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
