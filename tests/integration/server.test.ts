// US2: el backend sólo puede exponer lo que el contrato declara (FR-040..FR-047, SC-005).
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { makeGetServiceHealth } from "../../src/application/system/index.js";
import { buildServer, type ContractDocument } from "../../src/infrastructure/http/build-server.js";
import { makeGetHealth } from "../../src/interface-adapters/http/controllers/system/get-health.js";
import { json, problemOf } from "../helpers/json.js";
import type { components } from "../../src/interface-adapters/http/generated/api.js";
import type {
  Handlers,
  OperationsMap,
  SecurityHandler,
  operations,
} from "../../src/interface-adapters/http/typed.js";
import type { FastifyInstance } from "fastify";

// Tipos del contrato de prueba two-ops.yaml (a mano: es un fixture, no se genera).
interface Thing {
  kind: "a" | "b";
  note?: string;
}
interface Problem {
  content: { "application/problem+json": components["schemas"]["ProblemDetails"] };
}
interface TwoOps {
  getHealth: operations["getHealth"];
  listThings: {
    parameters: Record<string, never>;
    responses: { 200: { content: { "application/json": Thing[] } }; 500: Problem };
  };
  createThing: {
    parameters: Record<string, never>;
    requestBody: { content: { "application/json": Thing } };
    responses: { 201: { content: { "application/json": Thing } }; 400: Problem; 422: Problem; 500: Problem };
  };
}

const load = (file: string): ContractDocument =>
  parse(readFileSync(path.resolve(file), "utf8")) as ContractDocument;
const realContract = load("contracts/dist/openapi.yaml");
const twoOps = load("tests/integration/fixtures/two-ops.yaml");

const now = () => new Date("2026-09-16T12:00:00.000Z");
const getHealth = makeGetHealth(makeGetServiceHealth({ contractVersion: "1.0.0", clock: { now } }));
const healthHandlers: Handlers = { getHealth };

const PROBLEM = "application/problem+json";

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function server<Ops extends OperationsMap<Ops> = operations>(
  definition: ContractDocument,
  handlers: Handlers<NoInfer<Ops>>,
  security?: Record<string, SecurityHandler>,
): Promise<FastifyInstance> {
  app = await buildServer<Ops>({
    definition,
    handlers,
    mode: "real",
    logger: false,
    ...(security && { security }),
  });
  return app;
}

describe("servidor real sobre el contrato", () => {
  it("GET /v1/health responde 200 con un cuerpo conforme al esquema Health", async () => {
    const res = await (
      await server(realContract, healthHandlers)
    ).inject({ method: "GET", url: "/v1/health" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^application\/json/);
    expect(json(res)).toEqual({
      status: "ok",
      contractVersion: "1.0.0",
      timestamp: "2026-09-16T12:00:00.000Z",
    });
  });

  it("ruta no declarada → 404 Problem Details", async () => {
    const res = await (await server(realContract, healthHandlers)).inject({ method: "GET", url: "/nope" });
    expect(res.statusCode).toBe(404);
    expect(res.headers["content-type"]).toMatch(PROBLEM);
    expect(json(res)).toMatchObject({ type: "urn:ope:problem:not-found", status: 404, instance: "/nope" });
  });

  it("método no declarado → 405 Problem Details con header Allow", async () => {
    const res = await (
      await server(realContract, healthHandlers)
    ).inject({ method: "POST", url: "/v1/health" });
    expect(res.statusCode).toBe(405);
    expect(res.headers["content-type"]).toMatch(PROBLEM);
    expect(res.headers.allow).toBe("GET");
    expect(json(res)).toMatchObject({ type: "urn:ope:problem:method-not-allowed", status: 405 });
  });

  it("método no estándar (QUERY) sobre un path declarado → 405; sobre uno no declarado → 404", async () => {
    const srv = await server(realContract, healthHandlers);
    const known = await srv.inject({ method: "QUERY" as "GET", url: "/v1/health" });
    expect(known.statusCode).toBe(405);
    expect(known.headers.allow).toBe("GET");
    const unknown = await srv.inject({ method: "QUERY" as "GET", url: "/nope" });
    expect(unknown.statusCode).toBe(404);
    expect(json(unknown)).toMatchObject({ type: "urn:ope:problem:not-found" });
  });

  it("operación declarada sin manejador → 501 Problem Details, nunca un 200 vacío", async () => {
    const res = await (
      await server<TwoOps>(twoOps, healthHandlers)
    ).inject({ method: "GET", url: "/v1/things" });
    expect(res.statusCode).toBe(501);
    expect(res.headers["content-type"]).toMatch(PROBLEM);
    const body = problemOf(res);
    expect(body).toMatchObject({ type: "urn:ope:problem:not-implemented", status: 501 });
    expect(body.detail).toContain("listThings");
  });

  // Provisional (feature 004, T009): las operaciones nuevas existen en el contrato antes que su
  // manejador. Se reemplaza por las pruebas de ingesta y exposición en US2/US4.
  it("POST /v1/events y /v1/exposures declaradas sin manejador → 501 (nunca 404)", async () => {
    const s = await server(realContract, healthHandlers, {
      ingestKey: () => ({ merchant: { merchantId: "m_x", ingestKeys: ["k"], origins: [] } }),
    });
    const ids = { sessionId: "ses_00000001", visitorId: "vis_00000001" };
    const bodies: Record<string, Record<string, unknown>> = {
      "/v1/events": {
        events: [
          {
            type: "product_viewed",
            eventId: "evt_00000001",
            ...ids,
            occurredAt: "2026-09-16T12:00:00Z",
            page: { pageType: "product", productId: "SKU-1" },
            device: "mobile",
          },
        ],
      },
      "/v1/exposures": {
        decisionId: "dec_00000001",
        ...ids,
        exposedAt: "2026-09-16T12:00:00Z",
        anchor: "size_selector",
      },
    };
    for (const [url, payload] of Object.entries(bodies)) {
      const res = await s.inject({ method: "POST", url, payload, headers: { "x-ope-ingest-key": "k" } });
      expect(res.statusCode, url).toBe(501);
      expect(problemOf(res).type).toBe("urn:ope:problem:not-implemented");
    }
  });

  it("una operación con `security` declarado y sin security handler falla cerrada: 401", async () => {
    const s = await server(realContract, healthHandlers);
    const res = await s.inject({ method: "POST", url: "/v1/events", payload: {} });
    expect(res.statusCode).toBe(401);
    expect(problemOf(res).type).toBe("urn:ope:problem:unauthorized");
  });

  it("query no declarada → 400 con la violación enumerada y sin invocar el manejador", async () => {
    let invoked = false;
    const handlers: Handlers = {
      getHealth: async (req) => {
        invoked = true;
        return getHealth(req);
      },
    };
    const res = await (await server(realContract, handlers)).inject({ method: "GET", url: "/v1/health?x=1" });
    expect(res.statusCode).toBe(400);
    expect(res.headers["content-type"]).toMatch(PROBLEM);
    const body = problemOf(res);
    expect(body).toMatchObject({
      type: "urn:ope:problem:validation-failed",
      status: 400,
      instance: "/v1/health",
    });
    expect(body.errors?.[0]?.pointer).toBe("/query/x");
    expect(invoked).toBe(false);
  });

  it("JSON inválido en el body → 400 Problem Details", async () => {
    const res = await (
      await server<TwoOps>(twoOps, healthHandlers)
    ).inject({
      method: "POST",
      url: "/v1/things",
      headers: { "content-type": "application/json" },
      payload: "{not json",
    });
    expect(res.statusCode).toBe(400);
    expect(res.headers["content-type"]).toMatch(PROBLEM);
    expect(json(res)).toMatchObject({ type: "urn:ope:problem:validation-failed", status: 400 });
  });

  it("campo no declarado en el body → 400 que nombra el campo; no se ignora", async () => {
    const handlers: Handlers<TwoOps> = {
      ...healthHandlers,
      createThing: async () => ({ status: 201, body: { kind: "a" } }),
    };
    const res = await (
      await server<TwoOps>(twoOps, handlers)
    ).inject({
      method: "POST",
      url: "/v1/things",
      payload: { kind: "a", extra: 1 },
    });
    expect(res.statusCode).toBe(400);
    const body = problemOf(res);
    expect(body.errors?.some((e) => e.pointer === "/body/extra")).toBe(true);
  });

  it("body válido → el manejador se invoca con el body tipado y responde 201", async () => {
    const handlers: Handlers<TwoOps> = {
      ...healthHandlers,
      createThing: async (req) => ({ status: 201, body: { kind: req.body.kind, note: "creado" } }),
    };
    const res = await (
      await server<TwoOps>(twoOps, handlers)
    ).inject({ method: "POST", url: "/v1/things", payload: { kind: "b" } });
    expect(res.statusCode).toBe(201);
    expect(json(res)).toEqual({ kind: "b", note: "creado" });
  });

  it("respuesta del manejador fuera del contrato → 500 Problem Details; el cuerpo inválido no sale", async () => {
    const handlers = {
      getHealth: async () => ({ status: 200, body: { status: "ok", secreto: "no debe salir" } }),
    } as unknown as Handlers;
    const res = await (await server(realContract, handlers)).inject({ method: "GET", url: "/v1/health" });
    expect(res.statusCode).toBe(500);
    expect(res.headers["content-type"]).toMatch(PROBLEM);
    expect(json(res)).toMatchObject({ type: "urn:ope:problem:response-contract-violation", status: 500 });
    expect(res.body).not.toContain("secreto");
  });

  it("código de respuesta no declarado → 500 response-contract-violation", async () => {
    const handlers = {
      getHealth: async () => ({
        status: 203,
        body: { status: "ok", contractVersion: "1.0.0", timestamp: "2026-09-16T12:00:00Z" },
      }),
    } as unknown as Handlers;
    const res = await (await server(realContract, handlers)).inject({ method: "GET", url: "/v1/health" });
    expect(res.statusCode).toBe(500);
    expect(json(res)).toMatchObject({ type: "urn:ope:problem:response-contract-violation" });
  });

  it("manejador que lanza → 500 genérico sin exponer el mensaje interno", async () => {
    const handlers: Handlers = {
      getHealth: async () => {
        throw new Error("secreto interno");
      },
    };
    const res = await (await server(realContract, handlers)).inject({ method: "GET", url: "/v1/health" });
    expect(res.statusCode).toBe(500);
    expect(json(res)).toMatchObject({ type: "urn:ope:problem:internal-error", status: 500 });
    expect(res.body).not.toContain("secreto interno");
  });

  it("no arranca con un contrato inválido y explica el motivo", async () => {
    const invalid = {
      openapi: "3.1.0",
      info: { title: "sin version" },
      paths: {},
    } as unknown as ContractDocument;
    await expect(
      buildServer({ definition: invalid, handlers: {}, mode: "real", logger: false }),
    ).rejects.toThrow(/version|not valid/i);
  });

  it("rechaza registrar un manejador con un operationId inexistente (SC-005)", async () => {
    const handlers = { doesNotExist: async () => ({ status: 200, body: {} }) } as unknown as Handlers;
    await expect(
      buildServer({ definition: realContract, handlers, mode: "real", logger: false }),
    ).rejects.toThrow(/doesNotExist/);
  });
});
