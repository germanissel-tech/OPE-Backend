// US1 (FR-003, FR-005; ADR-013): la aplicación entera sale del composition root, con perfil de
// memoria y reemplazos puntuales; close() apaga en orden.
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
  it("devuelve la app, los puertos y close(); GET /v1/health responde como siempre", async () => {
    app = await startTestApp();
    expect(app.ports.clock).toBeDefined();
    const res = await app.app.inject({ method: "GET", url: "/v1/health" });
    expect(res.statusCode).toBe(200);
    expect(json(res)).toMatchObject({ status: "ok", contractVersion: "1.1.0" });
  });

  it("un override de puerto reemplaza al del perfil: el reloj fijo aparece en la respuesta", async () => {
    app = await startTestApp({ ports: { clock: fixedClock("2026-01-01T00:00:00.000Z") } });
    const res = await app.app.inject({ method: "GET", url: "/v1/health" });
    expect(json(res)).toMatchObject({ timestamp: "2026-01-01T00:00:00.000Z" });
  });

  it("sin override usa el reloj del perfil (el del sistema)", async () => {
    app = await startTestApp();
    const before = Date.now();
    const res = await app.app.inject({ method: "GET", url: "/v1/health" });
    const body = json(res) as { timestamp: string };
    expect(Date.parse(body.timestamp)).toBeGreaterThanOrEqual(before - 1000);
  });

  it("close() cierra el servidor y después los gateways que exponen close(), en orden inverso", async () => {
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

  it("en modo mock responde los ejemplos del contrato", async () => {
    app = await startTestApp({}, { mode: "mock" });
    const res = await app.app.inject({ method: "GET", url: "/v1/health" });
    expect(res.statusCode).toBe(200);
    expect(json(res)).toMatchObject({ status: "ok" });
  });
});
