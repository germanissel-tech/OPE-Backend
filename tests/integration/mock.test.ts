// US3: el mock responde el ejemplo del contrato y rechaza igual que el servidor real.
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { buildServer, type ContractDocument } from "../../src/adapters/http/build-server.js";
import { makeGetHealth } from "../../src/handlers/health.js";
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
    handlers: { getHealth: makeGetHealth({ contractVersion: "1.0.0", clock: { now: () => new Date() } }) },
    mode: "real",
    logger: false,
  });
  apps.push(app);
  return app;
}

describe("servidor en modo mock", () => {
  it("GET /v1/health responde 200 con exactamente el ejemplo declarado en el contrato", async () => {
    const res = await (await mock()).inject({ method: "GET", url: "/v1/health" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/^application\/json/);
    expect(json(res)).toEqual(example.value);
  });

  it("rechaza un request inválido con el mismo código y Problem Details que el servidor real", async () => {
    const fromMock = await (await mock()).inject({ method: "GET", url: "/v1/health?x=1" });
    const fromReal = await (await real()).inject({ method: "GET", url: "/v1/health?x=1" });
    expect(fromMock.statusCode).toBe(400);
    expect(fromMock.statusCode).toBe(fromReal.statusCode);
    expect(fromMock.headers["content-type"]).toBe(fromReal.headers["content-type"]);
    expect(json(fromMock)).toEqual(json(fromReal));
  });

  it("ruta no declarada → 404 Problem Details, igual que el real", async () => {
    const fromMock = await (await mock()).inject({ method: "GET", url: "/nope" });
    const fromReal = await (await real()).inject({ method: "GET", url: "/nope" });
    expect(fromMock.statusCode).toBe(404);
    expect(json(fromMock)).toEqual(json(fromReal));
  });
});
