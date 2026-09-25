// Feature 004, US1 (FR-003, FR-005; ADR-013): the whole application comes out of the composition root, with
// the local profile and targeted replacements; close() shuts down in order.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { parse, stringify } from "yaml";
import { importSeed, type App } from "../../src/composition/bootstrap.js";
import { readConfig } from "../../src/composition/config.js";
import { replace, type Closable } from "../../src/composition/graph/index.js";
import { AdminLogPort } from "../../src/composition/modules/admin.js";
import { ExperimentStorePort } from "../../src/composition/modules/experiment.js";
import { DecisionIdsPort } from "../../src/composition/modules/ledger.js";
import { MerchantStorePort } from "../../src/composition/modules/merchant.js";
import { ClockPort } from "../../src/composition/modules/shared-kernel.js";
import { asDecisionId } from "../../src/domain/ledger/index.js";
import { asExperimentId, asMerchantId } from "../../src/domain/shared-kernel/index.js";
import { json } from "../helpers/json.js";
import { fixedClock, startTestApp, testConfig } from "../helpers/test-app.js";
import type { DecisionIdGenerator } from "../../src/application/ledger/index.js";
import type { Clock } from "../../src/application/shared-kernel/index.js";
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
    expect(app.resolve(ClockPort)).toBeDefined();
    const res = await app.app.inject({ method: "GET", url: "/v1/health" });
    expect(res.statusCode).toBe(200);
    expect(json(res)).toMatchObject({ status: "ok", contractVersion: "1.7.0" });
  });

  it("a port override replaces the profile one: the fixed clock shows in the response", async () => {
    app = await startTestApp({ ports: [replace(ClockPort, fixedClock("2026-01-01T00:00:00.000Z"))] });
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
    const clock: Clock & Closable = { now: () => new Date(), close: () => void closed.push("clock") };
    const ids: DecisionIdGenerator & Closable = {
      next: () => asDecisionId("dec_x"),
      close: () => void closed.push("ids"),
    };
    app = await startTestApp({ ports: [replace(ClockPort, clock), replace(DecisionIdsPort, ids)] });
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
    // A caller may serve what its deployment does not: the handler the contract asks for.
    const orphans = { listOrphans: () => Promise.resolve({ status: 200, body: {} }) } as unknown as Handlers;
    app = await startTestApp({ handlers: orphans }, { contractPath });
    expect((await app.app.inject({ method: "GET", url: "/v1/orphans" })).statusCode).toBe(200);
  });
});

describe("bootstrap — the seed of the merchants (feature 017, FR-009)", () => {
  it("an empty store imports OPE_MERCHANTS on behalf of the system operator; a populated one keeps its merchants", async () => {
    app = await startTestApp({ ports: [replace(ClockPort, fixedClock("2026-09-20T12:00:00.000Z"))] });
    const merchant = await app.resolve(MerchantStorePort).get(asMerchantId("m_a"));
    expect(merchant?.status).toBe("active");
    expect(merchant?.createdAt).toEqual(new Date("2026-09-20T12:00:00.000Z"));
    const log = await app.resolve(AdminLogPort).list({ limit: 10 });
    expect(log.items.map((e) => [e.operation, e.operatorId, e.outcome])).toEqual([
      ["importMerchantConfiguration", "system", "accepted"],
      ["importExperiments", "system", "accepted"],
      ["importMerchantConfiguration", "system", "accepted"],
      ["importMerchants", "system", "accepted"],
    ]);
    expect(log.items[0]?.result).toEqual({ configurationVersion: 1 });
    // The experiment of the seed is recorded as active from its opening, judged by the store (feature 017).
    const experiment = await app
      .resolve(ExperimentStorePort)
      .get(asMerchantId("m_a"), asExperimentId("exp_a_000001"));
    expect(experiment?.record()).toMatchObject({
      status: "active",
      openedAt: new Date("2026-09-17T00:00:00.000Z"),
      windowStartedAt: new Date("2026-09-17T00:00:00.000Z"),
    });
    // The seed again: the merchants are kept, and so are their versions and experiments (nothing enters twice).
    await importSeed(testConfig(), app);
    const again = await app.resolve(AdminLogPort).list({ limit: 10 });
    expect(again.items).toHaveLength(8);
    expect(
      (await app.resolve(ExperimentStorePort).listOf(asMerchantId("m_a"), { limit: 10 })).items,
    ).toHaveLength(1);
    expect(again.items.filter((e) => e.result !== undefined)).toHaveLength(2);
    expect((await app.resolve(MerchantStorePort).list({ limit: 10 })).items.map((m) => m.merchantId)).toEqual(
      ["m_a", "m_b"],
    );
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
