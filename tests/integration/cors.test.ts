// US5 (FR-040; ADR-014): sólo la tienda del merchant puede hablar con el backend desde el
// navegador. El preflight acepta cualquier origen registrado (no trae credencial); el request
// real exige el par credencial + origen.
import { afterEach, describe, expect, it } from "vitest";
import { problemOf } from "../helpers/json.js";
import { batchOf, postEvents, startTestApp } from "../helpers/test-app.js";
import type { App } from "../../src/composition/bootstrap.js";

let app: App | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

const preflight = (a: App, origin: string) =>
  a.app.inject({
    method: "OPTIONS",
    url: "/v1/events",
    headers: {
      origin,
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type, x-ope-ingest-key",
    },
  });

describe("orígenes por merchant", () => {
  it("preflight desde un origen registrado → 204 con Allow-Origin, el método y el header de la clave", async () => {
    app = await startTestApp();
    const res = await preflight(app, "https://a.example");
    expect(res.statusCode).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("https://a.example");
    expect(String(res.headers["access-control-allow-methods"])).toContain("POST");
    expect(String(res.headers["access-control-allow-headers"]).toLowerCase()).toContain("x-ope-ingest-key");
  });

  it("preflight desde un origen que ningún merchant registró → sin Allow-Origin", async () => {
    app = await startTestApp();
    const res = await preflight(app, "https://nadie.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("el preflight no cae en la ruta comodín del contrato (no responde 405)", async () => {
    app = await startTestApp();
    const res = await preflight(app, "https://b.example");
    expect(res.statusCode).not.toBe(405);
    expect(res.statusCode).toBe(204);
  });

  it("[invariant:origin-not-allowed] clave de un merchant con Origin de otro → 403", async () => {
    app = await startTestApp();
    const res = await postEvents(app.app, batchOf(1), { key: "key-a-1", origin: "https://b.example" });
    expect(res.statusCode).toBe(403);
    expect(problemOf(res)).toMatchObject({ type: "urn:ope:problem:origin-not-allowed", status: 403 });
  });

  it("clave y Origin del mismo merchant → pasa la seguridad y trae Allow-Origin en la respuesta", async () => {
    app = await startTestApp();
    const res = await postEvents(app.app, batchOf(1), { key: "key-a-1", origin: "https://a.example" });
    expect([401, 403]).not.toContain(res.statusCode);
    expect(res.headers["access-control-allow-origin"]).toBe("https://a.example");
  });

  it("sin Origin (servidor a servidor, pruebas) se procesa con normalidad", async () => {
    app = await startTestApp();
    const res = await postEvents(app.app, batchOf(1), { key: "key-a-1" });
    expect([401, 403]).not.toContain(res.statusCode);
  });

  it("no habilita credenciales de navegador (cookies) ni orígenes comodín", async () => {
    app = await startTestApp();
    const res = await preflight(app, "https://a.example");
    expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
    expect(res.headers["access-control-allow-origin"]).not.toBe("*");
  });
});
