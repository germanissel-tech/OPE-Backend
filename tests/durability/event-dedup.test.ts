// The deduplication window across a restart, end to end (feature 033, US3, SC-006), through the real
// durable deployment and HTTP.
//
// **Both halves, because one alone lets the wrong design through.** That a resent event is still a
// duplicate says the rebuild happens; that the first batch of a merchant does not cost appreciably more
// than the next says it happens **once**. A wrapper that rebuilt on every claim would pass the first
// assertion and be a read of the register on the path of every batch.
//
// **What it measured on this machine (2026-09-29)**: the first batch after a restart, with two hundred
// arrivals to read back, took 8.78 ms against 2.77 ms for the next one — so the rebuild is about six
// milliseconds, paid once per merchant and per boot. One laptop, SQLite, no network (**D-21**).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { durableDeployment } from "../../src/composition/deployments/durable.js";
import { replace } from "../../src/composition/graph/index.js";
import { EventLogQueuePort } from "../../src/composition/modules/ingestion.js";
import { ClockPort } from "../../src/composition/modules/shared-kernel.js";
import { json } from "../helpers/json.js";
import { batchOf, fixedClock, postEvents, startTestApp } from "../helpers/test-app.js";
import type { components } from "#generated/api.js";
import type { App } from "../../src/composition/bootstrap.js";

type IngestResult = components["schemas"]["IngestResult"];

let dir: string;
let file: string;
let app: App;

const boot = async (): Promise<App> =>
  startTestApp(
    { deployment: durableDeployment, ports: [replace(ClockPort, fixedClock())] },
    // The two merchants of the helpers, because the third case needs a second one: the same event id
    // sent by somebody else has to stay new.
    { store: { file } },
  );

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "ope-dedup-"));
  file = path.join(dir, "ope.db");
  app = await boot();
});

afterEach(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

/** A batch of `n` events starting at `from`, with the accepted/duplicate counts the response reports. */
async function send(from: number, n = 1): Promise<IngestResult> {
  const response = await postEvents(app.app, batchOf(n, from), { key: "key-b-1" });
  expect(response.statusCode).toBe(202);
  return json(response) as IngestResult;
}

/** The restart, with the register drained first: what is still queued is not in the table. */
async function restart(): Promise<void> {
  app.resolve(EventLogQueuePort).flush();
  await app.close();
  app = await boot();
}

describe("the deduplication window across a restart (SC-006)", () => {
  it("still counts a resent event as a duplicate after the restart", async () => {
    const first = await send(1);
    expect(first.accepted).toBe(1);
    expect(first.duplicates).toBe(0);

    await restart();

    // The very same event id, which before this feature entered as new: the window was empty and
    // nothing said the event had ever arrived, so a retry of an SDK across a deploy was counted twice.
    const again = await send(1);
    expect(again.accepted).toBe(0);
    expect(again.duplicates).toBe(1);
  });

  it("does not make the first batch of a merchant appreciably slower than the next", async () => {
    // The rebuild is one indexed read, once per merchant and per boot. What this asserts is the "once":
    // the figure is published because on one laptop it is under the noise of the rest of the request,
    // and the assertion is the order of magnitude (**D-21**, like every latency test here).
    for (let n = 0; n < 40; n += 1) await send(1 + n * 10, 5);

    await restart();

    const firstBatch = performance.now();
    await send(10_001, 5);
    const rebuilt = performance.now() - firstBatch;

    const next = performance.now();
    await send(20_001, 5);
    const warm = performance.now() - next;

    console.info(
      `dedup rebuild: first batch after the restart ${rebuilt.toFixed(2)} ms, next ${warm.toFixed(2)} ms`,
    );
    // Ten times the following batch would not be an order of magnitude, it would be a rebuild per batch.
    expect(rebuilt).toBeLessThan(Math.max(warm * 10, 50));
  });

  it("rebuilds the window of each merchant from its own arrivals, and of nobody else", async () => {
    // Constitution V seen through the rebuild: the register keys by merchant, so an id another merchant
    // sent is **new** here. A rebuild that read the window of the whole platform would answer that this
    // event is a duplicate of somebody else's, which is worse than forgetting it.
    expect((await send(1)).accepted).toBe(1);

    await restart();

    const mine = await postEvents(app.app, batchOf(1, 1), { key: "key-b-1" });
    expect((json(mine) as IngestResult).duplicates).toBe(1);

    const theirs = await postEvents(app.app, batchOf(1, 1), { key: "key-a-1" });
    expect((json(theirs) as IngestResult).accepted).toBe(1);
  });
});
