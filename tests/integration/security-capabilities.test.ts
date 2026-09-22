// Feature 010, US4 (FR-021, FR-022, FR-031; ADR-025): the two credentials are not interchangeable, a
// merchant without platform keys still starts, and the platform key never reaches the log.
import { afterEach, describe, expect, it } from "vitest";
import { replace } from "../../src/composition/graph/index.js";
import { ClockPort, LoggerPort } from "../../src/composition/modules/shared-kernel.js";
import { problemOf } from "../helpers/json.js";
import { batchOf, catalogOf, fixedClock, postEvents, putCatalog, startTestApp } from "../helpers/test-app.js";
import { recordingLogger } from "../helpers/unavailable-ledgers.js";
import type { App } from "../../src/composition/bootstrap.js";

const NOW = "2026-09-18T12:00:00.000Z";

let app: App | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("credentials by consumer", () => {
  it("the platform key of A does not ingest events; the ingest key of A does not push catalogue", async () => {
    app = await startTestApp({ ports: [replace(ClockPort, fixedClock(NOW))] });
    const events = await postEvents(app.app, batchOf(1, 1, { occurredAt: NOW }), { key: "platform-a-1" });
    expect(events.statusCode).toBe(401);
    const catalog = await putCatalog(app.app, catalogOf(1, NOW), { platformKey: "key-a-1" });
    expect(catalog.statusCode).toBe(401);
    expect(problemOf(catalog)).toMatchObject({ type: "urn:ope:problem:unauthorized" });
  });

  it("a merchant configured without platform keys starts and simply cannot receive a catalogue", async () => {
    app = await startTestApp(
      { ports: [replace(ClockPort, fixedClock(NOW))] },
      {
        merchants: [
          {
            merchantId: "m_single",
            ingestKeys: ["key-single"],
            origins: ["https://single.example"],
            experiments: [],
          },
        ],
      },
    );
    expect(
      (await postEvents(app.app, batchOf(1, 1, { occurredAt: NOW }), { key: "key-single" })).statusCode,
    ).toBe(202);
    expect((await putCatalog(app.app, catalogOf(1, NOW), { platformKey: "key-single" })).statusCode).toBe(
      401,
    );
  });

  it("the platform key never appears in the log of an upsert", async () => {
    const { logger, entries } = recordingLogger();
    app = await startTestApp({ ports: [replace(ClockPort, fixedClock(NOW)), replace(LoggerPort, logger)] });
    const res = await putCatalog(app.app, catalogOf(1, NOW), { platformKey: "platform-a-1" });
    expect(res.statusCode).toBe(201);
    expect(JSON.stringify(entries)).not.toContain("platform-a-1");
    expect(entries.find((e) => e.message === "catalog snapshot replaced")?.fields).toMatchObject({
      merchantId: "m_a",
      products: 1,
    });
  });
});
