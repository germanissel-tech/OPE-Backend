// Feature 017 — Phase 2 (FR-007, FR-008): the first admin path: an operator authenticates with a
// bearer token before the body is read and reads the admin log, newest first, paginated.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { asOperatorId } from "../../src/domain/operator/index.js";
import { asExperimentId, asMerchantId } from "../../src/domain/shared-kernel/index.js";
import { json, problemOf } from "../helpers/json.js";
import { admin, sharedTestApp, startTestApp, type SharedApp } from "../helpers/test-app.js";
import { recordingLogger } from "../helpers/unavailable-ledgers.js";

let app: SharedApp;
beforeAll(async () => {
  app = await sharedTestApp();
});
afterAll(() => app.close());
beforeEach(async () => {
  await app.resetPorts();
});

const entry = (n: number) => ({
  at: new Date(Date.UTC(2026, 8, 20, 12, 0, n)),
  operatorId: asOperatorId("ops-all"),
  operation: `op${n}`,
  merchantId: asMerchantId("m_a"),
  outcome: "accepted" as const,
});

describe("GET /v1/admin/log", () => {
  it.each([
    ["no header", undefined],
    ["not a bearer", "Basic abc"],
    ["unknown token", "Bearer nobody"],
  ])("%s → 401 operator-unknown before anything else", async (_name, authorization) => {
    const res = await app.app.inject({
      method: "GET",
      url: "/v1/admin/log",
      headers: authorization === undefined ? {} : { authorization },
    });
    expect(res.statusCode).toBe(401);
    expect(problemOf(res)).toMatchObject({
      type: "urn:ope:problem:operator-unknown",
      instance: "/v1/admin/log",
    });
  });

  it("an operator reads the log newest first and pages it with the cursor", async () => {
    for (const n of [1, 2, 3]) await app.ports.adminLog.record(entry(n));
    const first = await admin(app.app, "GET", "/v1/admin/log?limit=2");
    expect(first.statusCode).toBe(200);
    const page = json(first) as { items: { operation: string; at: string }[]; nextCursor?: string };
    expect(page.items.map((e) => e.operation)).toEqual(["op3", "op2"]);
    expect(page.items[0]?.at).toBe("2026-09-20T12:00:03.000Z");
    expect(page.nextCursor).toBeDefined();
    const second = json(await admin(app.app, "GET", `/v1/admin/log?limit=5&cursor=${page.nextCursor}`)) as {
      items: { operation: string }[];
      nextCursor?: string;
    };
    // The seed: the merchants, then what each declared of its configuration and its experiments (feature 017).
    expect(second.items.map((e) => e.operation)).toEqual([
      "op1",
      "importMerchantConfiguration",
      "importExperiments",
      "importMerchantConfiguration",
      "importMerchants",
    ]);
    expect(second).not.toHaveProperty("nextCursor");
  });

  it("an entry carries what the action produced, the code and the reason only when present", async () => {
    await app.ports.adminLog.record({
      ...entry(1),
      operation: "publishMerchantConfiguration",
      result: { configurationVersion: 2, windowRestarted: true },
      reason: "anchor fix",
    });
    await app.ports.adminLog.record({ ...entry(2), outcome: "rejected", code: "configuration-frozen" });
    await app.ports.adminLog.record({
      ...entry(3),
      operation: "activateExperiment",
      result: { experimentId: asExperimentId("exp-2026-10") },
    });
    const page = json(await admin(app.app, "GET", "/v1/admin/log")) as { items: Record<string, unknown>[] };
    expect(page.items[0]).toMatchObject({
      operation: "activateExperiment",
      result: { experimentId: asExperimentId("exp-2026-10") },
    });
    expect(page.items[2]).toStrictEqual({
      at: "2026-09-20T12:00:01.000Z",
      operatorId: "ops-all",
      operation: "publishMerchantConfiguration",
      merchantId: "m_a",
      outcome: "accepted",
      result: { configurationVersion: 2, windowRestarted: true },
      reason: "anchor fix",
    });
    expect(page.items[1]).toStrictEqual({
      at: "2026-09-20T12:00:02.000Z",
      operatorId: "ops-all",
      operation: "op2",
      merchantId: "m_a",
      outcome: "rejected",
      code: "configuration-frozen",
    });
  });

  it("a scoped operator reads the whole log (it is of the platform); a limit above the contract's maximum is 400", async () => {
    await app.ports.adminLog.record(entry(1));
    expect((await admin(app.app, "GET", "/v1/admin/log", { as: "ops-a" })).statusCode).toBe(200);
    const res = await admin(app.app, "GET", "/v1/admin/log?limit=1000");
    expect(res.statusCode).toBe(400);
    expect(problemOf(res).errors?.some((e) => e.pointer.includes("limit"))).toBe(true);
  });

  it("the bearer token never reaches the log; the use case is logged by name", async () => {
    const { logger, entries } = recordingLogger();
    const own = await startTestApp({ ports: { logger } });
    try {
      await admin(own.app, "GET", "/v1/admin/log");
    } finally {
      await own.close();
    }
    const text = JSON.stringify(entries);
    expect(text).not.toContain("admin-token-all");
    expect(entries.find((e) => e.message === "use case executed")?.fields).toMatchObject({
      useCase: "listAdminLog",
      outcome: "ok",
    });
  });
});
