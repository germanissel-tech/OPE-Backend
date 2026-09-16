import { describe, expect, it } from "vitest";
import { makeGetHealth } from "../../src/handlers/health.js";

describe("getHealth", () => {
  const fixed = new Date("2026-09-16T12:00:00.000Z");
  const handler = makeGetHealth({ contractVersion: "1.0.0", clock: { now: () => fixed } });

  it("responde 200 con status, versión del contrato y timestamp del reloj inyectado", async () => {
    const res = await handler({
      operationId: "getHealth",
      instance: "/v1/health",
      path: undefined,
      query: undefined,
      headers: undefined,
      cookie: undefined,
      body: undefined,
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: "ok",
      contractVersion: "1.0.0",
      timestamp: "2026-09-16T12:00:00.000Z",
    });
  });

  it("es una función pura: dos llamadas con el mismo reloj devuelven lo mismo", async () => {
    const req = {
      operationId: "getHealth" as const,
      instance: "/v1/health",
      path: undefined,
      query: undefined,
      headers: undefined,
      cookie: undefined,
      body: undefined,
    };
    expect(await handler(req)).toEqual(await handler(req));
  });
});
