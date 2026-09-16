// US3: the mock responds with the contract example and rejects just like the real server.
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { makeGetServiceHealth } from "../../src/application/system/index.js";
import { buildServer, type ContractDocument } from "../../src/infrastructure/http/build-server.js";
import { makeGetHealth } from "../../src/interface-adapters/http/controllers/system/get-health.js";
import { json } from "../helpers/json.js";
import type { FastifyInstance } from "fastify";

const contract = parse(readFileSync(path.resolve("contracts/dist/openapi.yaml"), "utf8")) as ContractDocument;
const example = parse(readFileSync(path.resolve("contracts/examples/health-ok.yaml"), "utf8")) as {
  value: unknown;
};

const apps: FastifyInstance[] = [];
afterEach(async () => {
  await Promise.all(apps.splice(0).map((a) => a.close()));
});

async function mock(): Promise<FastifyInstance> {
  const app = await buildServer({ definition: contract, handlers: {}, mode: "mock", logger: false });
  apps.push(app);
  return app;
}
async function real(): Promise<FastifyInstance> {
  const app = await buildServer({
    definition: contract,
    handlers: {
      getHealth: makeGetHealth(
        makeGetServiceHealth({ contractVersion: "1.0.0", clock: { now: () => new Date() } }),
      ),
    },
    mode: "real",
    logger: false,
  });
  apps.push(app);
  return app;
}

describe("server in mock mode", () => {
  it("GET /v1/health responds 200 with exactly the example declared in the contract", async () => {
    const res = await (await mock()).inject({ method: "GET", url: "/v1/health" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^application\/json/);
    expect(json(res)).toEqual(example.value);
  });

  it("rejects an invalid request with the same status and Problem Details as the real server", async () => {
    const fromMock = await (await mock()).inject({ method: "GET", url: "/v1/health?x=1" });
    const fromReal = await (await real()).inject({ method: "GET", url: "/v1/health?x=1" });
    expect(fromMock.statusCode).toBe(400);
    expect(fromMock.statusCode).toBe(fromReal.statusCode);
    expect(fromMock.headers["content-type"]).toBe(fromReal.headers["content-type"]);
    expect(json(fromMock)).toEqual(json(fromReal));
  });

  it("undeclared path → 404 Problem Details, same as the real one", async () => {
    const fromMock = await (await mock()).inject({ method: "GET", url: "/nope" });
    const fromReal = await (await real()).inject({ method: "GET", url: "/nope" });
    expect(fromMock.statusCode).toBe(404);
    expect(json(fromMock)).toEqual(json(fromReal));
  });
});
