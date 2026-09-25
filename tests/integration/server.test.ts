// Feature 001, US2: the backend can only expose what the contract declares (FR-040..FR-047, SC-005).
import { readFileSync } from "node:fs";
import path from "node:path";
import { Writable } from "node:stream";
import pino from "pino";
import { afterEach, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { GetServiceHealthUseCase } from "../../src/application/system/index.js";
import { buildServer, type ContractDocument } from "../../src/infrastructure/http/build-server.js";
import { pinoLogger, silentLogger } from "../../src/infrastructure/logging/pino-logger.js";
import { problem } from "../../src/interface-adapters/http/problem-details.js";
import { makeGetHealth } from "../../src/interface-adapters/system/controllers/get-health.js";
import { json, problemOf } from "../helpers/json.js";
import type { components } from "#generated/api.js";
import type {
  Handlers,
  OperationsMap,
  SecurityScheme,
  operations,
} from "../../src/interface-adapters/http/typed.js";
import type { FastifyInstance } from "fastify";

// Types of the test contract two-ops.yaml (by hand: it is a fixture, not generated).
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
const getHealth = makeGetHealth(
  new GetServiceHealthUseCase({ contract: { version: "1.0.0" }, clock: { now } }),
);
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
  security?: Record<string, SecurityScheme>,
): Promise<FastifyInstance> {
  app = await buildServer<Ops>({
    definition,
    handlers,
    retryAfterSeconds: 5,
    logger: silentLogger(),
    ...(security && { security }),
  });
  return app;
}

describe("real server over the contract", () => {
  it("GET /v1/health responds 200 with a body conforming to the Health schema", async () => {
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
    expect(problemOf(res).detail).toBe("There is no operation for GET /nope.");
  });

  it("the body limit by consumer (F-057) reads the operation before routing: a public operation, an unknown path and a guarded operation nobody wired all keep the browser's limit", async () => {
    const srv = await server(realContract, healthHandlers);
    // A body on a public operation: the limit applies, the body is ignored, the operation answers.
    const withBody = await srv.inject({ method: "GET", url: "/v1/health", payload: { ignored: true } });
    expect(withBody.statusCode).toBe(200);
    // A body on an unknown path: the limit applies, then the contract's 404.
    const unknown = await srv.inject({ method: "POST", url: "/nope", payload: { ignored: true } });
    expect(unknown.statusCode).toBe(404);
    expect(json(unknown)).toMatchObject({ type: "urn:ope:problem:not-found" });
    // A guarded operation with no security wired: the browser's limit, before any credential check.
    const oversized = await srv.inject({
      method: "POST",
      url: "/v1/events",
      headers: { "content-type": "application/json" },
      payload: `{"events":[],"filler":"${"x".repeat(1024 * 1024 + 1)}"}`,
    });
    expect(oversized.statusCode).toBe(413);
    expect(json(oversized)).toMatchObject({ type: "urn:ope:problem:payload-too-large" });
  });

  it("an error escaping the transport (a hook that throws) → 500 internal-error Problem Details with its instance, logged, and the server survives", async () => {
    const srv = await server(realContract, healthHandlers);
    srv.addHook("onRequest", async (request) => {
      if (request.headers["x-test-boom"] !== undefined) throw new Error("boom from a hook");
    });
    const res = await srv.inject({ method: "GET", url: "/v1/health?x=1", headers: { "x-test-boom": "1" } });
    expect(res.statusCode).toBe(500);
    expect(res.headers["content-type"]).toMatch(PROBLEM);
    expect(json(res)).toEqual({
      type: "urn:ope:problem:internal-error",
      title: "Internal error",
      status: 500,
      instance: "/v1/health",
    });
    expect(res.body).not.toContain("boom");
    expect((await srv.inject({ method: "GET", url: "/v1/health" })).statusCode).toBe(200);
  });

  it("a URL Fastify cannot decode → 400 Problem Details, never Fastify's own JSON", async () => {
    const res = await (await server(realContract, healthHandlers)).inject({ method: "GET", url: "/v1/%zz" });
    expect(res.statusCode).toBe(400);
    expect(res.headers["content-type"]).toMatch(PROBLEM);
    expect(json(res)).toMatchObject({
      type: "urn:ope:problem:validation-failed",
      instance: "/v1/%zz",
      errors: [{ pointer: "/url" }],
    });
  });

  it("the root path is not declared either: 404 Problem Details, not Fastify's own not-found", async () => {
    const res = await (await server(realContract, healthHandlers)).inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(404);
    expect(res.headers["content-type"]).toMatch(PROBLEM);
    expect(json(res)).toMatchObject({ type: "urn:ope:problem:not-found", status: 404, instance: "/" });
  });

  it("undeclared method → 405 Problem Details with Allow header", async () => {
    const res = await (
      await server(realContract, healthHandlers)
    ).inject({ method: "POST", url: "/v1/health" });
    expect(res.statusCode).toBe(405);
    expect(res.headers["content-type"]).toMatch(PROBLEM);
    expect(res.headers.allow).toBe("GET");
    expect(json(res)).toMatchObject({
      type: "urn:ope:problem:method-not-allowed",
      status: 405,
      instance: "/v1/health",
      detail: "Declared methods: GET.",
    });
  });

  it("non-standard method (QUERY) on a declared path → 405; on an undeclared one → 404", async () => {
    const srv = await server(realContract, healthHandlers);
    const known = await srv.inject({ method: "QUERY" as "GET", url: "/v1/health" });
    expect(known.statusCode).toBe(405);
    expect(known.headers.allow).toBe("GET");
    const unknown = await srv.inject({ method: "QUERY" as "GET", url: "/nope" });
    expect(unknown.statusCode).toBe(404);
    expect(json(unknown)).toMatchObject({
      type: "urn:ope:problem:not-found",
      instance: "/nope",
      detail: "There is no operation for /nope.",
    });
  });

  // Robustness: an exception a module lets escape ends that request as 500 Problem Details
  // (type from the catalogue, no message, no stack) and is logged; the server keeps serving.
  it("an exception escaping a handler → 500 internal-error without internals, logged, and the server survives", async () => {
    const lines: string[] = [];
    const sink = new Writable({
      write(chunk: Buffer | string, _enc, cb) {
        lines.push(chunk.toString());
        cb();
      },
    });
    const logger = pinoLogger(pino({ level: "info" }, sink));
    const failing: Handlers<TwoOps> = {
      getHealth,
      listThings: () => {
        throw new Error("secret detail from a gateway");
      },
    };
    const s = await buildServer<TwoOps>({
      definition: twoOps,
      handlers: failing,
      logger,
      retryAfterSeconds: 5,
    });
    app = s;
    const res = await s.inject({ method: "GET", url: "/v1/things" });
    expect(res.statusCode).toBe(500);
    expect(res.headers["content-type"]).toMatch(PROBLEM);
    expect(problemOf(res)).toEqual({
      type: "urn:ope:problem:internal-error",
      title: "Internal error",
      status: 500,
      instance: "/v1/things",
    });
    expect(res.body).not.toContain("secret detail");
    const logged = lines.join("");
    expect(logged).toContain("secret detail from a gateway");
    expect(logged).toContain('"operationId":"listThings"');
    expect(logged).toContain("the handler threw an exception");
    expect((await s.inject({ method: "GET", url: "/v1/health" })).statusCode).toBe(200);
  });

  it("operation declared without a handler → 501 Problem Details, never an empty 200", async () => {
    const res = await (
      await server<TwoOps>(twoOps, healthHandlers)
    ).inject({ method: "GET", url: "/v1/things" });
    expect(res.statusCode).toBe(501);
    expect(res.headers["content-type"]).toMatch(PROBLEM);
    const body = problemOf(res);
    expect(body).toMatchObject({
      type: "urn:ope:problem:not-implemented",
      status: 501,
      instance: "/v1/things",
    });
    expect(body.detail).toContain("listThings");
  });

  // On the real contract: an authenticated, declared operation without a wired handler is 501.
  it("POST /v1/events and /v1/exposures declared without a handler → 501 (never 404)", async () => {
    const s = await server(realContract, healthHandlers, {
      ingestKey: {
        handler: () => ({
          principal: { merchant: { merchantId: "m_x", ingestKeys: ["k"], origins: [] } },
          capabilities: ["events:write"],
        }),
        header: "x-ope-ingest-key",
        consumer: "browser",
      },
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
        anchor: "variant_selector",
      },
    };
    for (const [url, payload] of Object.entries(bodies)) {
      const res = await s.inject({ method: "POST", url, payload, headers: { "x-ope-ingest-key": "k" } });
      expect(res.statusCode, url).toBe(501);
      expect(problemOf(res).type).toBe("urn:ope:problem:not-implemented");
    }
  });

  it("a credential without a required capability → 403 capability-missing before the body is read (ADR-025)", async () => {
    const s = await server(realContract, healthHandlers, {
      ingestKey: {
        handler: () => ({ principal: { merchant: { merchantId: "m_x" } }, capabilities: ["config:read"] }),
        header: "x-ope-ingest-key",
        consumer: "browser",
      },
    });
    const res = await s.inject({
      method: "POST",
      url: "/v1/events",
      payload: {},
      headers: { "x-ope-ingest-key": "k" },
    });
    expect(res.statusCode).toBe(403);
    expect(problemOf(res)).toMatchObject({
      type: "urn:ope:problem:capability-missing",
      instance: "/v1/events",
    });
  });

  it("an operation with declared `security` and no security handler fails closed: 401", async () => {
    const s = await server(realContract, healthHandlers);
    const res = await s.inject({ method: "POST", url: "/v1/events", payload: {} });
    expect(res.statusCode).toBe(401);
    expect(problemOf(res)).toMatchObject({ type: "urn:ope:problem:unauthorized", instance: "/v1/events" });
  });

  it("undeclared query → 400 with the violation listed and without invoking the handler", async () => {
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

  it("invalid JSON in the body → 400 Problem Details", async () => {
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
    const body = problemOf(res);
    expect(body).toMatchObject({
      type: "urn:ope:problem:validation-failed",
      status: 400,
      instance: "/v1/things",
    });
    // The parser error points at the whole body, with Fastify's message.
    expect(body.errors).toHaveLength(1);
    expect(body.errors?.[0]?.pointer).toBe("/body");
    expect(body.errors?.[0]?.message).toMatch(/JSON/);
  });

  it("undeclared field in the body → 400 naming the field; it is not ignored", async () => {
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

  it("valid body → the handler is invoked with the typed body and responds 201", async () => {
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

  it("handler response outside the contract → 500 Problem Details; the invalid body does not go out", async () => {
    const handlers = {
      getHealth: async () => ({ status: 200, body: { status: "ok", secret: "must not go out" } }),
    } as unknown as Handlers;
    const res = await (await server(realContract, handlers)).inject({ method: "GET", url: "/v1/health" });
    expect(res.statusCode).toBe(500);
    expect(res.headers["content-type"]).toMatch(PROBLEM);
    expect(json(res)).toMatchObject({
      type: "urn:ope:problem:response-contract-violation",
      status: 500,
      instance: "/v1/health",
    });
    expect(res.body).not.toContain("secreto");
  });

  it("undeclared response status → 500 response-contract-violation", async () => {
    const handlers = {
      getHealth: async () => ({
        status: 203,
        body: { status: "ok", contractVersion: "1.0.0", timestamp: "2026-09-16T12:00:00Z" },
      }),
    } as unknown as Handlers;
    const res = await (await server(realContract, handlers)).inject({ method: "GET", url: "/v1/health" });
    expect(res.statusCode).toBe(500);
    expect(json(res)).toMatchObject({
      type: "urn:ope:problem:response-contract-violation",
      instance: "/v1/health",
    });
  });

  it("handler that throws → generic 500 without exposing the internal message", async () => {
    const handlers: Handlers = {
      getHealth: async () => {
        throw new Error("secreto interno");
      },
    };
    const res = await (await server(realContract, handlers)).inject({ method: "GET", url: "/v1/health" });
    expect(res.statusCode).toBe(500);
    expect(json(res)).toMatchObject({
      type: "urn:ope:problem:internal-error",
      status: 500,
      instance: "/v1/health",
    });
    expect(res.body).not.toContain("secreto interno");
  });

  it("a declared 4xx returned by a handler goes out as Problem Details, from 400 on", async () => {
    const handlers: Handlers = {
      getHealth: async () => ({
        status: 400,
        body: problem("validation-failed", { instance: "/v1/health" }).body,
      }),
    };
    const res = await (await server(realContract, handlers)).inject({ method: "GET", url: "/v1/health" });
    expect(res.statusCode).toBe(400);
    expect(res.headers["content-type"]).toMatch(PROBLEM);
  });

  it("does not start with an invalid contract and explains why", async () => {
    const invalid = {
      openapi: "3.1.0",
      info: { title: "no version" },
      paths: {},
    } as unknown as ContractDocument;
    await expect(
      buildServer({ definition: invalid, handlers: {}, logger: silentLogger(), retryAfterSeconds: 5 }),
    ).rejects.toThrow(/version|not valid/i);
  });

  it("refuses to register a handler with a nonexistent operationId (SC-005)", async () => {
    const handlers = { doesNotExist: async () => ({ status: 200, body: {} }) } as unknown as Handlers;
    await expect(
      buildServer({ definition: realContract, handlers, logger: silentLogger(), retryAfterSeconds: 5 }),
    ).rejects.toThrow(/doesNotExist/);
  });
});
