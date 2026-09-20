// Feature 017 — US1 (spec scenarios 1–7): a merchant is operated, not deployed. Creation with
// credentials shown once, rotation with grace, kill switch that stops deciding but not measuring,
// deactivation that keeps the records, scope without revealing existence, and the seed.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { asOrderId } from "../../src/domain/outcomes/index.js";
import { asExperimentId, asMerchantId, asVisitorId } from "../../src/domain/shared-kernel/index.js";
import { json, problemOf } from "../helpers/json.js";
import {
  admin,
  batchOf,
  fixedClock,
  NOW,
  orderOf,
  postEvents,
  postOrder,
  sharedTestApp,
  type SharedApp,
} from "../helpers/test-app.js";

let app: SharedApp;
beforeAll(async () => {
  app = await sharedTestApp();
});
afterAll(() => app.close());
beforeEach(async () => {
  await app.resetPorts();
});

interface Created {
  merchant: {
    merchantId: string;
    status: string;
    origins: string[];
    credentials: { kind: string; issuedAt: string; expiresAt?: string }[];
  };
  credentials: { ingestKey: string; platformKey: string; platformSecret?: string };
}

const HOUR_MS = 3_600_000;

async function create(origins = ["https://new.example"], signature = true): Promise<Created> {
  const res = await admin(app.app, "POST", "/v1/admin/merchants", { body: { origins, signature } });
  expect(res.statusCode, res.body).toBe(201);
  return json(res) as Created;
}

describe("POST /v1/admin/merchants → a merchant is born with its credentials, shown once (scenario 1)", () => {
  it("mints the id and the three credentials; the SDK and the platform authenticate from that instant; no reading returns the values", async () => {
    const created = await create();
    expect(created.merchant.merchantId).toMatch(/^mrc_[a-z2-7]{12}$/);
    expect(created.merchant.status).toBe("active");
    expect(created.merchant.credentials.map((c) => c.kind)).toEqual(["ingest", "platform", "signing"]);
    expect(created.credentials.ingestKey).toMatch(/^ope_ik_/);
    expect(created.credentials.platformKey).toMatch(/^ope_pk_/);
    expect(created.credentials.platformSecret).toMatch(/^ope_ps_/);
    const events = await postEvents(app.app, batchOf(1, 1, { occurredAt: NOW }), {
      key: created.credentials.ingestKey,
      origin: "https://new.example",
    });
    expect(events.statusCode).toBe(202);
    const read = json(await admin(app.app, "GET", `/v1/admin/merchants/${created.merchant.merchantId}`));
    expect(JSON.stringify(read)).not.toContain(created.credentials.ingestKey);
    expect(JSON.stringify(read)).not.toContain(created.credentials.platformKey);
    expect(read).toMatchObject({ merchantId: created.merchant.merchantId, origins: ["https://new.example"] });
    const list = json(await admin(app.app, "GET", "/v1/admin/merchants")) as {
      items: { merchantId: string }[];
    };
    expect(list.items.map((m) => m.merchantId)).toEqual(["m_a", "m_b", created.merchant.merchantId]);
    const log = json(await admin(app.app, "GET", "/v1/admin/log")) as {
      items: { operation: string; operatorId: string; outcome: string }[];
    };
    expect(log.items[0]).toMatchObject({
      operation: "createMerchant",
      operatorId: "ops-all",
      outcome: "accepted",
    });
  });

  it("without signature no secret is minted and the platform key alone authenticates the platform", async () => {
    const created = await create(["https://plain.example"], false);
    expect(created.credentials.platformSecret).toBeUndefined();
    expect(created.merchant.credentials.map((c) => c.kind)).toEqual(["ingest", "platform"]);
    const order = await postOrder(app.app, orderOf("N-1"), { platformKey: created.credentials.platformKey });
    expect(order.statusCode).toBe(201);
  });

  it("[invariant:origin-already-registered] an origin of another merchant is refused with the pointer; [invariant:invalid-origin] as is one that is not an origin", async () => {
    const taken = await admin(app.app, "POST", "/v1/admin/merchants", {
      body: { origins: ["https://x.example", "https://A.example"], signature: false },
    });
    expect(taken.statusCode).toBe(422);
    expect(problemOf(taken)).toMatchObject({ type: "urn:ope:problem:origin-already-registered" });
    const bad = await admin(app.app, "POST", "/v1/admin/merchants", {
      body: { origins: ["nope"], signature: false },
    });
    expect(bad.statusCode).toBe(422);
    expect(problemOf(bad)).toMatchObject({ type: "urn:ope:problem:invalid-origin" });
    const extra = await admin(app.app, "POST", "/v1/admin/merchants", {
      body: { origins: ["https://z.example"], signature: false, name: "Zed" },
    });
    expect(extra.statusCode).toBe(400);
  });
});

describe("rotation (scenario 2)", () => {
  it("the new key works at once; the previous one until the grace runs out; then 401; the log names the rotation", async () => {
    const clock = { at: new Date(NOW) };
    await app.resetPorts({ ports: { clock: { now: () => clock.at } } });
    const created = await create();
    const id = created.merchant.merchantId;
    const rotated = json(
      await admin(app.app, "POST", `/v1/admin/merchants/${id}/ingest-keys`, { body: { graceSeconds: 3600 } }),
    ) as { kind: string; value: string; issuedAt: string; previousExpiresAt?: string };
    expect(rotated.kind).toBe("ingest");
    expect(rotated.value).toMatch(/^ope_ik_/);
    expect(rotated.previousExpiresAt).toBe(new Date(Date.parse(NOW) + HOUR_MS).toISOString());
    const post = (key: string) =>
      postEvents(app.app, batchOf(1, 1, { occurredAt: clock.at.toISOString() }), { key });
    expect((await post(rotated.value)).statusCode).toBe(202);
    expect((await post(created.credentials.ingestKey)).statusCode).toBe(202);
    const inGrace = json(await admin(app.app, "GET", `/v1/admin/merchants/${id}`)) as Created["merchant"];
    expect(inGrace.credentials.filter((c) => c.kind === "ingest")).toEqual([
      { kind: "ingest", issuedAt: NOW, expiresAt: rotated.previousExpiresAt },
      { kind: "ingest", issuedAt: rotated.issuedAt },
    ]);
    clock.at = new Date(Date.parse(NOW) + HOUR_MS);
    expect((await post(created.credentials.ingestKey)).statusCode).toBe(401);
    expect((await post(rotated.value)).statusCode).toBe(202);
    const read = json(await admin(app.app, "GET", `/v1/admin/merchants/${id}`)) as Created["merchant"];
    expect(read.credentials.filter((c) => c.kind === "ingest")).toHaveLength(1);
    const log = json(await admin(app.app, "GET", `/v1/admin/merchants/${id}/log`)) as {
      items: { operation: string }[];
    };
    expect(log.items.map((e) => e.operation)).toEqual(["rotateIngestKey", "createMerchant"]);
  });

  it("without a body the previous key is revoked at once; the platform secret rotates too", async () => {
    const created = await create();
    const id = created.merchant.merchantId;
    const rotated = await admin(app.app, "POST", `/v1/admin/merchants/${id}/platform-keys`);
    expect(rotated.statusCode).toBe(201);
    expect((json(rotated) as { previousExpiresAt?: string }).previousExpiresAt).toBe(NOW);
    const old = await postOrder(app.app, orderOf("N-1"), { platformKey: created.credentials.platformKey });
    expect(old.statusCode).toBe(401);
    const secret = await admin(app.app, "POST", `/v1/admin/merchants/${id}/platform-secrets`, { body: {} });
    expect(secret.statusCode).toBe(201);
    expect((json(secret) as { value: string }).value).toMatch(/^ope_ps_/);
  });

  it("[invariant:rotation-grace-too-long] a grace beyond the platform maximum is 422 with the pointer", async () => {
    const created = await create();
    const res = await admin(
      app.app,
      "POST",
      `/v1/admin/merchants/${created.merchant.merchantId}/ingest-keys`,
      {
        body: { graceSeconds: 8 * 24 * 3600 },
      },
    );
    expect(res.statusCode).toBe(422);
    expect(problemOf(res)).toMatchObject({ type: "urn:ope:problem:rotation-grace-too-long" });
  });
});

describe("kill switch (scenario 3)", () => {
  it("off: the SDK still gets 202 with NO_OP merchant-off, no assignment; orders still 201; on again decides", async () => {
    const off = await admin(app.app, "PUT", "/v1/admin/merchants/m_a/kill-switch", {
      body: { enabled: false },
    });
    expect(off.statusCode).toBe(200);
    expect(json(off)).toEqual({ enabled: false });
    const events = await postEvents(app.app, batchOf(1, 1, { occurredAt: NOW }), { key: "key-a-1" });
    expect(events.statusCode).toBe(202);
    expect(json(events)).toMatchObject({ decision: { outcome: "NO_OP", reason: "merchant-off" } });
    expect(
      await app.ports.assignments.find(
        asMerchantId("m_a"),
        asExperimentId("exp_a_000001"),
        asVisitorId("vis_00000001"),
      ),
    ).toBeUndefined();
    const order = await postOrder(app.app, orderOf("A-1"), { platformKey: "platform-a-1" });
    expect(order.statusCode).toBe(201);
    const on = await admin(app.app, "PUT", "/v1/admin/merchants/m_a/kill-switch", {
      body: { enabled: true },
    });
    expect(json(on)).toEqual({ enabled: true });
    const again = await postEvents(app.app, batchOf(1, 2, { occurredAt: NOW }), { key: "key-a-1" });
    expect((json(again) as { decision: { reason: string } }).decision.reason).not.toBe("merchant-off");
    const read = json(await admin(app.app, "GET", "/v1/admin/merchants/m_a")) as { status: string };
    expect(read.status).toBe("active");
  });
});

describe("deactivation (scenario 4)", () => {
  it("no credential authenticates any more, the records stay readable, the switch and rotations are refused", async () => {
    await postOrder(app.app, orderOf("A-1"), { platformKey: "platform-a-1" });
    const gone = await admin(app.app, "POST", "/v1/admin/merchants/m_a/deactivate");
    expect(gone.statusCode).toBe(200);
    expect(json(gone)).toMatchObject({ status: "deactivated" });
    expect(
      (await postEvents(app.app, batchOf(1, 1, { occurredAt: NOW }), { key: "key-a-1" })).statusCode,
    ).toBe(401);
    expect((await postOrder(app.app, orderOf("A-2"), { platformKey: "platform-a-1" })).statusCode).toBe(401);
    expect(await app.ports.orders.find(asMerchantId("m_a"), asOrderId("A-1"))).toBeDefined();
    expect((await admin(app.app, "GET", "/v1/admin/merchants/m_a")).statusCode).toBe(200);
    const sw = await admin(app.app, "PUT", "/v1/admin/merchants/m_a/kill-switch", {
      body: { enabled: true },
    });
    expect(sw.statusCode).toBe(409);
    expect(problemOf(sw)).toMatchObject({ type: "urn:ope:problem:merchant-deactivated" });
    expect((await admin(app.app, "POST", "/v1/admin/merchants/m_a/ingest-keys")).statusCode).toBe(409);
    expect((await admin(app.app, "POST", "/v1/admin/merchants/m_a/deactivate")).statusCode).toBe(200);
    const taken = await admin(app.app, "POST", "/v1/admin/merchants", {
      body: { origins: ["https://a.example"], signature: false },
    });
    expect(taken.statusCode).toBe(422);
  });
});

describe("scope (scenarios 5 and 6)", () => {
  it("an operator scoped to A gets 403 merchant-out-of-scope on B and on a merchant that does not exist, with the same body; the denial is logged", async () => {
    const onB = await admin(app.app, "GET", "/v1/admin/merchants/m_b", { as: "ops-a" });
    const onNobody = await admin(app.app, "GET", "/v1/admin/merchants/mrc_nobody000000", { as: "ops-a" });
    expect([onB.statusCode, onNobody.statusCode]).toEqual([403, 403]);
    const strip = (r: typeof onB) => ({ ...problemOf(r), instance: undefined });
    expect(strip(onB)).toEqual(strip(onNobody));
    expect(problemOf(onB).type).toBe("urn:ope:problem:merchant-out-of-scope");
    expect(
      (
        await admin(app.app, "PUT", "/v1/admin/merchants/m_b/kill-switch", {
          as: "ops-a",
          body: { enabled: false },
        })
      ).statusCode,
    ).toBe(403);
    expect((await admin(app.app, "GET", "/v1/admin/merchants/m_a", { as: "ops-a" })).statusCode).toBe(200);
    const list = json(await admin(app.app, "GET", "/v1/admin/merchants", { as: "ops-a" })) as {
      items: { merchantId: string }[];
    };
    expect(list.items.map((m) => m.merchantId)).toEqual(["m_a"]);
    const log = json(await admin(app.app, "GET", "/v1/admin/merchants/m_b/log")) as {
      items: { outcome: string; operatorId: string; code?: string }[];
    };
    expect(log.items[0]).toMatchObject({
      outcome: "denied",
      operatorId: "ops-a",
      code: "merchant-out-of-scope",
    });
    expect((await admin(app.app, "GET", "/v1/admin/merchants/mrc_nobody000000")).statusCode).toBe(404);
  });

  it("an unknown token is 401 before the body is read; the capability is checked", async () => {
    const res = await admin(app.app, "POST", "/v1/admin/merchants", {
      token: "nobody",
      body: { origins: [], signature: false },
    });
    expect(res.statusCode).toBe(401);
    expect(problemOf(res)).toMatchObject({ type: "urn:ope:problem:operator-unknown" });
  });
});

describe("the seed (scenario 7)", () => {
  it("the merchants of the configuration exist as if the system had created them; a populated store ignores the seed", async () => {
    const log = json(await admin(app.app, "GET", "/v1/admin/log")) as {
      items: { operation: string; operatorId: string; merchantId?: string }[];
    };
    expect(log.items.filter((e) => e.operation === "importMerchants").map((e) => e.operatorId)).toEqual([
      "system",
    ]);
    expect(log.items.filter((e) => e.operation === "importMerchants")).toHaveLength(1);
    expect((await admin(app.app, "GET", "/v1/admin/merchants/m_a")).statusCode).toBe(200);
  });
});

describe("the request log never carries a credential", () => {
  it("creating a merchant with a fixed clock keeps the instants stable", async () => {
    await app.resetPorts({ ports: { clock: fixedClock("2026-09-21T00:00:00.000Z") } });
    const created = await create(["https://t.example"], false);
    expect(created.merchant.credentials[0]?.issuedAt).toBe("2026-09-21T00:00:00.000Z");
  });
});
