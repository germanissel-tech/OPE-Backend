// US5 (FR-010, FR-017; ADR-014): la credencial de ingesta identifica al merchant antes que nada.
import { afterEach, describe, expect, it } from "vitest";
import { problemOf } from "../helpers/json.js";
import { batchOf, postEvents, startTestApp } from "../helpers/test-app.js";
import type { App } from "../../src/composition/bootstrap.js";

let app: App | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("credencial de ingesta (X-OPE-Ingest-Key)", () => {
  it("sin header → 401 unauthorized como Problem Details, antes que la validación del body", async () => {
    app = await startTestApp();
    const res = await postEvents(app.app, { garbage: true });
    expect(res.statusCode).toBe(401);
    expect(res.headers["content-type"]).toMatch("application/problem+json");
    expect(problemOf(res)).toMatchObject({ type: "urn:ope:problem:unauthorized", status: 401 });
  });

  it("clave desconocida → 401; la respuesta no dice si la clave existe para otro merchant", async () => {
    app = await startTestApp();
    const res = await postEvents(app.app, batchOf(1), { key: "key-nadie" });
    expect(res.statusCode).toBe(401);
    expect(problemOf(res).type).toBe("urn:ope:problem:unauthorized");
    expect(res.body).not.toContain("key-nadie");
  });

  it("clave válida con body inválido → 400: la seguridad va primero, la validación después", async () => {
    app = await startTestApp();
    const res = await postEvents(app.app, { garbage: true }, { key: "key-a-1" });
    expect(res.statusCode).toBe(400);
    expect(problemOf(res).type).toBe("urn:ope:problem:validation-failed");
  });

  it("cualquiera de las dos claves activas del merchant pasa la seguridad (rotación)", async () => {
    app = await startTestApp();
    for (const key of ["key-a-1", "key-a-2"]) {
      const res = await postEvents(app.app, batchOf(1), { key });
      expect(res.statusCode, key).not.toBe(401);
      expect(res.statusCode, key).not.toBe(403);
    }
  });

  it("ni la clave ni el merchantId aparecen en ninguna respuesta", async () => {
    app = await startTestApp();
    const res = await postEvents(app.app, batchOf(1), { key: "key-a-1" });
    expect(res.body).not.toContain("key-a-1");
    expect(res.body).not.toContain("m_a");
  });
});
