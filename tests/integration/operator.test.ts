// Feature 040 — US4 (FR-001..FR-003) and US2 (FR-005, FR-007; ADR-044): every response names its
// request, a Problem Details carries the same identifier in `requestId`, a pasted identifier is
// not adopted, and `getOperator` answers who the token belongs to — and nothing about anybody else.
import { Writable } from "node:stream";
import pino from "pino";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { replace } from "../../src/composition/graph/index.js";
import { LoggerPort } from "../../src/composition/modules/shared-kernel.js";
import { pinoLogger } from "../../src/infrastructure/logging/pino-logger.js";
import { json, problemOf } from "../helpers/json.js";
import { admin, sharedTestApp, startTestApp, type SharedApp } from "../helpers/test-app.js";
import type { App } from "../../src/composition/bootstrap.js";

const REQUEST_ID = "x-request-id";

let app: SharedApp;
beforeAll(async () => {
  app = await sharedTestApp();
});
afterAll(() => app.close());

const requestIdOf = (headers: Record<string, unknown>): string => {
  const value = headers[REQUEST_ID];
  if (typeof value !== "string" || value === "") throw new Error(`no ${REQUEST_ID} header`);
  return value;
};

describe("X-Request-Id (US4)", () => {
  it("every response carries it: a 200, a 401 and a 404 alike, each with its own value", async () => {
    const ok = await admin(app.app, "GET", "/v1/admin/operator");
    const denied = await admin(app.app, "GET", "/v1/admin/operator", { as: null });
    const missing = await admin(app.app, "GET", "/v1/admin/nothing-here");
    expect([ok.statusCode, denied.statusCode, missing.statusCode]).toEqual([200, 401, 404]);
    const ids = [ok, denied, missing].map((r) => requestIdOf(r.headers));
    expect(new Set(ids).size).toBe(3);
  });

  it("a Problem Details says which request failed: requestId equals the header", async () => {
    const res = await admin(app.app, "GET", "/v1/admin/operator", { as: null });
    expect(res.statusCode).toBe(401);
    expect(problemOf(res).requestId).toBe(requestIdOf(res.headers));
  });

  it("a successful body does not carry it: the header is enough", async () => {
    const res = await admin(app.app, "GET", "/v1/admin/operator");
    expect(json(res)).not.toHaveProperty("requestId");
  });

  it("a pasted X-Request-Id is not adopted: the identifier is always the server's", async () => {
    const res = await app.app.inject({
      method: "GET",
      url: "/v1/admin/operator",
      headers: { authorization: "Bearer admin-token-all", [REQUEST_ID]: "pasted-by-a-client" },
    });
    expect(res.statusCode).toBe(200);
    expect(requestIdOf(res.headers)).not.toBe("pasted-by-a-client");
  });
});

describe("X-Request-Id is the reqId of the log", () => {
  let own: App | undefined;
  afterEach(async () => {
    await own?.close();
    own = undefined;
  });

  it("what an operator quotes is what the log has", async () => {
    const chunks: string[] = [];
    const sink = new Writable({
      write(chunk: Buffer | string, _enc, cb) {
        chunks.push(chunk.toString());
        cb();
      },
    });
    own = await startTestApp({ ports: [replace(LoggerPort, pinoLogger(pino({ level: "info" }, sink)))] });
    const res = await admin(own.app, "GET", "/v1/admin/operator", { as: null });
    expect(res.statusCode).toBe(401);
    const quoted = problemOf(res).requestId;
    const entries = chunks
      .join("")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as Record<string, unknown>);
    const incoming = entries.find((e) => e["msg"] === "incoming request");
    expect(incoming?.["reqId"]).toBe(quoted);
  });
});

describe("GET /v1/admin/operator (US2)", () => {
  it("answers who the token belongs to: identifier, display name and scope", async () => {
    const res = await admin(app.app, "GET", "/v1/admin/operator", { as: "ops-all" });
    expect(res.statusCode).toBe(200);
    expect(json(res)).toEqual({ operatorId: "ops-all", displayName: "Operator All", scope: "*" });
  });

  it("an operator nobody named has no displayName, and a listed scope comes as the list", async () => {
    const res = await admin(app.app, "GET", "/v1/admin/operator", { as: "ops-a" });
    expect(res.statusCode).toBe(200);
    expect(json(res)).toEqual({ operatorId: "ops-a", scope: ["m_a"] });
  });

  it("an unknown credential is 401 operator-unknown, with its requestId", async () => {
    const res = await admin(app.app, "GET", "/v1/admin/operator", { token: "not-a-token" });
    expect(res.statusCode).toBe(401);
    expect(problemOf(res)).toMatchObject({ type: "urn:ope:problem:operator-unknown" });
    expect(problemOf(res).requestId).toBe(requestIdOf(res.headers));
  });

  it("the answer names no credential and no token: only what the operator already knows", async () => {
    const res = await admin(app.app, "GET", "/v1/admin/operator", { as: "ops-all" });
    expect(res.body).not.toContain("admin-token");
    expect(res.body).not.toContain("tokenFingerprints");
    expect(Object.keys(json(res) as object).sort()).toEqual(["displayName", "operatorId", "scope"]);
  });
});
