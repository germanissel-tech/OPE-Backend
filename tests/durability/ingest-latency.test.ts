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
//
// **Feature 033 added the second case, and it is that feature's condition of acceptance (SC-002).**
// Making the merchants durable puts the store behind the lookup that **every** request does before the
// body is validated: the merchant is resolved by the fingerprint of its credential. So the second case
// measures the same ingest with a store that holds every merchant, resolving the **last** of them —
// the worst case of a lookup that is linear over all of them — and against the same seed in memory.
//
// What it is honest about: the delta of either case is **the whole durable store**, the ledgers of
// features 030 and 031 included, and not the merchants alone. What isolates this feature's own cost is
// `tests/unit/interface-adapters/merchant/sqlite-merchant-store.test.ts`, which pins that the gateway
// reads its table once at boot and never again — the reads on the path come from the index. This case is
// what would catch that promise being broken by something the unit test cannot see.
//
// **What it measured, over three runs on this machine (2026-09-29).** The durable p95 with the twenty
// merchants in the store came out 6.78, 6.78 and 7.25 ms, against 7.85, 11.15 and 8.25 ms for the case
// with one merchant in the same runs — that is, **never worse, and within the spread of the case that
// stores no merchant at all**. The delta against memory stayed between 5.4 and 6.2 ms in the many case,
// which is the write of the ledgers and not the lookup. Making the merchants durable did not cost
// anything measurable on the path, which is what SC-002 asked. One laptop, SQLite, no network (**D-21**).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { durableDeployment } from "../../src/composition/deployments/durable.js";
import { localDeployment } from "../../src/composition/deployments/local.js";
import { replace } from "../../src/composition/graph/index.js";
import { ClockPort } from "../../src/composition/modules/shared-kernel.js";
import { batchOf, fixedClock, postEvents, startTestApp, type MerchantSpec } from "../helpers/test-app.js";
import type { App } from "../../src/composition/bootstrap.js";

const BATCHES = 200;
const EVENTS_PER_BATCH = 20;

/**
 * How many merchants the store holds in the second case. It is not a cap of anything: it is more than a
 * seed file would carry and enough that a lookup walking all of them would show, which is what makes the
 * figure worth publishing.
 */
const MERCHANTS = 20;

const named = (i: number): string => String(i).padStart(2, "0");
const keyOf = (i: number): string => `key-${named(i)}-1`;

const seed = (): MerchantSpec[] =>
  Array.from({ length: MERCHANTS }, (_, i) => ({
    merchantId: `m_${named(i)}`,
    ingestKeys: [keyOf(i)],
    origins: [`https://${named(i)}.example`],
    experiments: [],
  }));

/** The last one, because in memory the lookup by fingerprint is a walk and this is where it ends. */
const LAST_KEY = keyOf(MERCHANTS - 1);

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
let memoryOfMany: App;
let durableOfMany: App;

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "ope-latency-"));
  const clock = [replace(ClockPort, fixedClock())];
  memory = await startTestApp({ deployment: localDeployment, ports: clock });
  durable = await startTestApp(
    { deployment: durableDeployment, ports: clock },
    { store: { file: path.join(dir, "ope.db") } },
  );
  // The four apps live at once so that the JIT, the heap and the machine are the same for the four
  // measurements: two profiles times one merchant and many.
  const merchants = seed();
  memoryOfMany = await startTestApp({ deployment: localDeployment, ports: clock }, { merchants });
  durableOfMany = await startTestApp(
    { deployment: durableDeployment, ports: clock },
    { store: { file: path.join(dir, "merchants.db") }, merchants },
  );
});

afterAll(async () => {
  await memory.close();
  await durable.close();
  await memoryOfMany.close();
  await durableOfMany.close();
  rmSync(dir, { recursive: true, force: true });
});

function percentile(sorted: readonly number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? 0;
}

/** The percentiles of `BATCHES` ingests against one app, warm-up excluded. */
async function measure(app: App, from: number, key = "key-a-1"): Promise<{ p50: number; p95: number }> {
  for (let i = 0; i < 10; i += 1) {
    await postEvents(app.app, batchOf(EVENTS_PER_BATCH, from + i * EVENTS_PER_BATCH), { key });
  }
  const samples: number[] = [];
  for (let i = 0; i < BATCHES; i += 1) {
    const batch = batchOf(EVENTS_PER_BATCH, from + 1_000_000 + i * EVENTS_PER_BATCH);
    const start = performance.now();
    const response = await postEvents(app.app, batch, { key });
    samples.push(performance.now() - start);
    expect(response.statusCode).toBe(202);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  return { p50: percentile(sorted, 50), p95: percentile(sorted, 95) };
}

interface Profile {
  p50: number;
  p95: number;
}

/** The line the two cases publish. It is the result of the test: the assertion below is the floor. */
const report = (what: string, inMemory: Profile, onDisk: Profile): void => {
  console.info(
    [
      `ingest latency, ${what} (${BATCHES} batches x ${EVENTS_PER_BATCH} events, inject):`,
      `memory p50=${inMemory.p50.toFixed(2)} ms p95=${inMemory.p95.toFixed(2)} ms |`,
      `sqlite p50=${onDisk.p50.toFixed(2)} ms p95=${onDisk.p95.toFixed(2)} ms |`,
      `delta p95=${(onDisk.p95 - inMemory.p95).toFixed(2)} ms`,
    ].join(" "),
  );
};

describe("what the durable write costs on the critical path", () => {
  it(`stays under ${P95_BUDGET_MS} ms and reports the difference against the in-memory profile`, async () => {
    const inMemory = await measure(memory, 1);
    const onDisk = await measure(durable, 10_000_000);

    report("one merchant", inMemory, onDisk);

    expect(onDisk.p95).toBeLessThan(P95_BUDGET_MS);
  });

  it(`stays under ${P95_BUDGET_MS} ms with a store that holds every merchant it resolves`, async () => {
    // Feature 033, SC-002. The two apps carry the same seed and the request resolves the same merchant,
    // so what differs between the two figures is where the merchants **are** and nothing else — which is
    // the comparison the feature is accepted on.
    const inMemory = await measure(memoryOfMany, 20_000_000, LAST_KEY);
    const onDisk = await measure(durableOfMany, 30_000_000, LAST_KEY);

    report(`${MERCHANTS} merchants, resolving the last`, inMemory, onDisk);

    expect(onDisk.p95).toBeLessThan(P95_BUDGET_MS);
  });
});
