// US1 (FR-003, FR-005; ADR-013): the whole application comes out of the composition root, with
// the in-memory profile and targeted replacements; close() shuts down in order.
import { afterEach, describe, expect, it } from "vitest";
import { json } from "../helpers/json.js";
import { fixedClock, startTestApp } from "../helpers/test-app.js";
import type { App } from "../../src/composition/bootstrap.js";

let app: App | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("bootstrap", () => {
  it("returns the app, the ports and close(); GET /v1/health responds as always", async () => {
    app = await startTestApp();
    expect(app.ports.clock).toBeDefined();
    const res = await app.app.inject({ method: "GET", url: "/v1/health" });
    expect(res.statusCode).toBe(200);
    expect(json(res)).toMatchObject({ status: "ok", contractVersion: "1.1.0" });
  });

  it("a port override replaces the profile one: the fixed clock shows in the response", async () => {
    app = await startTestApp({ ports: { clock: fixedClock("2026-01-01T00:00:00.000Z") } });
    const res = await app.app.inject({ method: "GET", url: "/v1/health" });
    expect(json(res)).toMatchObject({ timestamp: "2026-01-01T00:00:00.000Z" });
  });

  it("without an override it uses the profile clock (the system one)", async () => {
    app = await startTestApp();
    const before = Date.now();
    const res = await app.app.inject({ method: "GET", url: "/v1/health" });
    const body = json(res) as { timestamp: string };
    expect(Date.parse(body.timestamp)).toBeGreaterThanOrEqual(before - 1000);
  });

  it("close() closes the server and then the gateways exposing close(), in reverse order", async () => {
    const closed: string[] = [];
    app = await startTestApp({
      ports: {
        clock: { now: () => new Date(), close: () => closed.push("clock") },
        ids: { decisionId: () => "dec_x" as never, close: () => closed.push("ids") },
      } as never,
    });
    const closing = app;
    app = undefined;
    await closing.close();
    expect(closed).toEqual(["ids", "clock"]);
    await expect(closing.app.inject({ method: "GET", url: "/v1/health" })).rejects.toThrow();
  });

  it("in mock mode it responds with the contract examples", async () => {
    app = await startTestApp({}, { mode: "mock" });
    const res = await app.app.inject({ method: "GET", url: "/v1/health" });
    expect(res.statusCode).toBe(200);
    expect(json(res)).toMatchObject({ status: "ok" });
  });
});
