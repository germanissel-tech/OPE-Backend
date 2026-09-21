// Feature 004, US1 (FR-001): the health operation answers with the contract version and the instant of the clock it was given.
import { describe, expect, it } from "vitest";
import { GetServiceHealthUseCase } from "../../../../src/application/system/index.js";
import { makeGetHealth } from "../../../../src/interface-adapters/system/controllers/get-health.js";

describe("getHealth", () => {
  const fixed = new Date("2026-09-16T12:00:00.000Z");
  const handler = makeGetHealth(
    new GetServiceHealthUseCase({ contract: { version: "1.0.0" }, clock: { now: () => fixed } }),
  );

  it("responds 200 with status, contract version and timestamp of the injected clock", async () => {
    const res = await handler({
      operationId: "getHealth",
      instance: "/v1/health",
      path: undefined,
      query: undefined,
      headers: undefined,
      cookie: undefined,
      body: undefined,
      security: {},
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: "ok",
      contractVersion: "1.0.0",
      timestamp: "2026-09-16T12:00:00.000Z",
    });
  });

  it("is a pure function: two calls with the same clock return the same", async () => {
    const req = {
      operationId: "getHealth" as const,
      instance: "/v1/health",
      path: undefined,
      query: undefined,
      headers: undefined,
      cookie: undefined,
      body: undefined,
      security: {},
    };
    expect(await handler(req)).toEqual(await handler(req));
  });
});
