// Feature 008, US5 (FR-040; ADR-023): the use cases served by HTTP are wrapped by the logging decorator in
// composition: one operational entry per execution with name, duration and outcome.
import { afterEach, describe, expect, it } from "vitest";
import { replace } from "../../src/composition/graph/index.js";
import { ClockPort, LoggerPort } from "../../src/composition/modules/shared-kernel.js";
import { batchOf, eventOf, fixedClock, postEvents, startTestApp } from "../helpers/test-app.js";
import { recordingLogger } from "../helpers/unavailable-ledgers.js";
import type { App } from "../../src/composition/bootstrap.js";

const NOW = "2026-09-17T12:00:00.000Z";
const KEY = "key-a-1";

let app: App | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("use case log", () => {
  it("an ingestion leaves one entry with the use case name, duration and outcome, and no request data", async () => {
    const { logger, entries } = recordingLogger();
    app = await startTestApp({ ports: [replace(ClockPort, fixedClock(NOW)), replace(LoggerPort, logger)] });
    const res = await postEvents(app.app, batchOf(2, 1, { occurredAt: NOW }), { key: KEY });
    expect(res.statusCode).toBe(202);
    const executed = entries.filter((e) => e.message === "use case executed");
    expect(executed).toHaveLength(1);
    expect(executed[0]?.fields).toEqual({ useCase: "ingestBatch", durationMs: 0, outcome: "ok" });
    expect(JSON.stringify(executed)).not.toContain("vis_");
  });

  it("a rejected batch reports the code of the error", async () => {
    const { logger, entries } = recordingLogger();
    app = await startTestApp({ ports: [replace(ClockPort, fixedClock(NOW)), replace(LoggerPort, logger)] });
    const mixed = {
      events: [eventOf(1, { occurredAt: NOW }), eventOf(2, { occurredAt: NOW, visitorId: "vis_00000002" })],
    };
    const res = await postEvents(app.app, mixed, { key: KEY });
    expect(res.statusCode).toBe(422);
    const executed = entries.find((e) => e.message === "use case executed");
    expect(executed?.fields).toMatchObject({ useCase: "ingestBatch", outcome: "session-visitor-mismatch" });
  });
});
