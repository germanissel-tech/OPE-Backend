// Feature 004, US1 (FR-003, FR-005; ADR-013): the whole application comes out of the composition root, with
// the local profile and targeted replacements; close() shuts down in order.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import { importSeed, type App } from "../../src/composition/bootstrap.js";
import { readConfig } from "../../src/composition/config.js";
import { MODULES } from "../../src/composition/modules/index.js";
import { asDecisionId } from "../../src/domain/ledger/index.js";
import { asMerchantId } from "../../src/domain/shared-kernel/index.js";
import { json } from "../helpers/json.js";
import { fixedClock, startTestApp, testConfig } from "../helpers/test-app.js";
import type { Ports } from "../../src/composition/ports.js";
import type { Module } from "../../src/composition/wiring.js";
import type { Handlers } from "../../src/interface-adapters/http/typed.js";

/** The real contract plus one public operation nobody serves, written next to the temp files. */
function withUnwiredOperation(operationId: string): string {
  const bundle = parse(readFileSync("contracts/dist/openapi.yaml", "utf8")) as {
    paths: Record<string, unknown>;
  };
  bundle.paths["/v1/orphans"] = {
    get: {
      operationId,
      security: [],
      responses: {
        "200": { description: "ok", content: { "application/json": { schema: { type: "object" } } } },
      },
    },
  };
  const file = path.join(tmp, `${operationId}.yaml`);
  writeFileSync(file, stringify(bundle));
  return file;
}

const tmp = mkdtempSync(path.join(os.tmpdir(), "ope-bootstrap-"));
afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

let app: App | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("bootstrap", () => {
  it("returns the app, the ports and close(); GET /v1/health responds as always", async () => {
    app = await startTestApp();
    expect(app.ports.clock).toBeDefined();
    const res = await app.app.inject({ method: "GET", url: "/v1/health" });
    expect(res.statusCode).toBe(200);
    expect(json(res)).toMatchObject({ status: "ok", contractVersion: "1.4.0" });
  });

  it("a port override replaces the profile one: the fixed clock shows in the response", async () => {
    app = await startTestApp({ ports: { clock: fixedClock("2026-01-01T00:00:00.000Z") } });
    const res = await app.app.inject({ method: "GET", url: "/v1/health" });
    expect(json(res)).toMatchObject({ timestamp: "2026-01-01T00:00:00.000Z" });
  });

  it("without an override it uses the profile clock (the system one)", async () => {
    app = await startTestApp();
    const before = Date.now();
    const res = await app.app.inject({ method: "GET", url: "/v1/health" });
    const body = json(res) as { timestamp: string };
    expect(Date.parse(body.timestamp)).toBeGreaterThanOrEqual(before - 1000);
  });

  it("close() closes the server and then the gateways exposing close(), in reverse order", async () => {
    const closed: string[] = [];
    app = await startTestApp({
      ports: {
        clock: { now: () => new Date(), close: () => closed.push("clock") },
        decisionIds: { next: () => asDecisionId("dec_x"), close: () => closed.push("ids") },
      } as never,
    });
    const closing = app;
    app = undefined;
    await closing.close();
    expect(closed).toEqual(["ids", "clock"]);
    await expect(closing.app.inject({ method: "GET", url: "/v1/health" })).rejects.toThrow();
  });

  // Constitution II (fail-closed): an operation the contract declares and no module serves is
  // found at boot, not by a 501 in production. A module passed by a caller may serve it.
  it("refuses to start when the contract declares an operation no module wires", async () => {
    const contractPath = withUnwiredOperation("listOrphans");
    await expect(startTestApp({}, { contractPath })).rejects.toThrow(/no module wires: listOrphans\./);
    const orphans: Module<Ports> = () => ({
      handlers: { listOrphans: async () => ({ status: 200, body: {} }) } as unknown as Handlers,
    });
    app = await startTestApp({ modules: [...MODULES, orphans] }, { contractPath });
    expect((await app.app.inject({ method: "GET", url: "/v1/orphans" })).statusCode).toBe(200);
  });
});

describe("bootstrap — the seed of the merchants (feature 017, FR-009)", () => {
  it("an empty store imports OPE_MERCHANTS on behalf of the system operator; a populated one keeps its merchants", async () => {
    app = await startTestApp({ ports: { clock: fixedClock("2026-09-20T12:00:00.000Z") } });
    const merchant = await app.ports.merchantStore.get(asMerchantId("m_a"));
    expect(merchant?.status).toBe("active");
    expect(merchant?.createdAt).toEqual(new Date("2026-09-20T12:00:00.000Z"));
    const log = await app.ports.adminLog.list({ limit: 10 });
    expect(log.items.map((e) => [e.operation, e.operatorId, e.outcome])).toEqual([
      ["importMerchants", "system", "accepted"],
    ]);
    await importSeed(testConfig(), app.ports);
    expect((await app.ports.adminLog.list({ limit: 10 })).items).toHaveLength(2);
    expect((await app.ports.merchantStore.list({ limit: 10 })).items.map((m) => m.merchantId)).toEqual([
      "m_a",
      "m_b",
    ]);
  });

  it("a seed the merchant rules reject stops the start naming the field (the configuration judges it first)", () => {
    expect(() =>
      readConfig(
        {
          OPE_MERCHANTS: JSON.stringify([
            { merchantId: "m_x", ingestKeys: ["k", "k"], origins: ["https://x.example"] },
          ]),
        },
        () => "",
      ),
    ).toThrow("merchants[0].ingestKeys[1] is invalid");
  });
});
