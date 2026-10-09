// Feature 017 — US1 (spec scenarios 1–7): a merchant is operated, not deployed. Creation with
// credentials shown once, rotation with grace, kill switch that stops deciding but not measuring,
// deactivation that keeps the records, scope without revealing existence, and the seed.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { replace } from "../../src/composition/graph/index.js";
import { AssignmentLedgerPort } from "../../src/composition/modules/experiment.js";
import { OrderLedgerPort } from "../../src/composition/modules/outcomes.js";
import { ClockPort } from "../../src/composition/modules/shared-kernel.js";
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

/** Every creation names the merchant (feature 041): the contract makes `displayName` mandatory. */
const NAMED = { displayName: "Nueva" };

async function create(origins = ["https://new.example"], signature = true): Promise<Created> {
  const res = await admin(app.app, "POST", "/v1/admin/merchants", { body: { origins, signature, ...NAMED } });
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
      body: { origins: ["https://x.example", "https://A.example"], signature: false, displayName: "Tienda" },
    });
    expect(taken.statusCode).toBe(422);
    expect(problemOf(taken)).toMatchObject({
      type: "urn:ope:problem:origin-already-registered",
      errors: [{ pointer: "/body/origins/1", message: expect.stringContaining("already belongs") as string }],
    });
    const bad = await admin(app.app, "POST", "/v1/admin/merchants", {
      body: { origins: ["nope"], signature: false, displayName: "Tienda" },
    });
    expect(bad.statusCode).toBe(422);
    expect(problemOf(bad)).toMatchObject({
      type: "urn:ope:problem:invalid-origin",
      errors: [{ pointer: "/body/origins/0" }],
    });
    const extra = await admin(app.app, "POST", "/v1/admin/merchants", {
      body: { origins: ["https://z.example"], signature: false, displayName: "Tienda", name: "Zed" },
    });
    expect(extra.statusCode).toBe(400);
  });
});

describe("rotation (scenario 2)", () => {
  it("the new key works at once; the previous one until the grace runs out; then 401; the log names the rotation", async () => {
    const clock = { at: new Date(NOW) };
    await app.resetPorts({ ports: [replace(ClockPort, { now: () => clock.at })] });
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
    expect(problemOf(res)).toMatchObject({
      type: "urn:ope:problem:rotation-grace-too-long",
      errors: [{ pointer: "/body/graceSeconds" }],
    });
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
      await app
        .resolve(AssignmentLedgerPort)
        .find(asMerchantId("m_a"), asExperimentId("exp_a_000001"), asVisitorId("vis_00000001")),
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
    expect(await app.resolve(OrderLedgerPort).find(asMerchantId("m_a"), asOrderId("A-1"))).toBeDefined();
    expect((await admin(app.app, "GET", "/v1/admin/merchants/m_a")).statusCode).toBe(200);
    const sw = await admin(app.app, "PUT", "/v1/admin/merchants/m_a/kill-switch", {
      body: { enabled: true },
    });
    expect(sw.statusCode).toBe(409);
    expect(problemOf(sw)).toMatchObject({ type: "urn:ope:problem:merchant-deactivated" });
    expect((await admin(app.app, "POST", "/v1/admin/merchants/m_a/ingest-keys")).statusCode).toBe(409);
    expect((await admin(app.app, "POST", "/v1/admin/merchants/m_a/deactivate")).statusCode).toBe(200);
    const taken = await admin(app.app, "POST", "/v1/admin/merchants", {
      body: { origins: ["https://a.example"], signature: false, displayName: "Tienda" },
    });
    expect(taken.statusCode).toBe(422);
  });
});

describe("scope (scenarios 5 and 6)", () => {
  it("an operator scoped to A gets 403 merchant-out-of-scope on B and on a merchant that does not exist, with the same body; the denial is logged", async () => {
    const onB = await admin(app.app, "GET", "/v1/admin/merchants/m_b", { as: "ops-a" });
    const onNobody = await admin(app.app, "GET", "/v1/admin/merchants/mrc_nobody000000", { as: "ops-a" });
    expect([onB.statusCode, onNobody.statusCode]).toEqual([403, 403]);
    // The instance and the request identifier are the only things that may differ (ADR-044).
    const strip = (r: typeof onB) => ({ ...problemOf(r), instance: undefined, requestId: undefined });
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
      body: { origins: [], signature: false, displayName: "Tienda" },
    });
    expect(res.statusCode).toBe(401);
    expect(problemOf(res)).toMatchObject({ type: "urn:ope:problem:operator-unknown" });
  });
});

// Feature 041 (ADR-045): the identity of a merchant — at creation, read back, replaced whole.
describe("the identity of a merchant", () => {
  const identity = {
    displayName: "Tienda Norte",
    storeUrl: "https://www.norte.example/es/",
    contact: { name: "Ana Smith", email: "ana@norte.example", phone: "+54 11 5555", role: "owner" },
    notes: "Pilot since October.",
  };
  type Identified = Created["merchant"] & Partial<typeof identity>;
  const read = async (id: string): Promise<Identified> =>
    json(await admin(app.app, "GET", `/v1/admin/merchants/${id}`)) as Identified;
  const listed = async (id: string): Promise<Identified | undefined> =>
    (json(await admin(app.app, "GET", "/v1/admin/merchants")) as { items: Identified[] }).items.find(
      (m) => m.merchantId === id,
    );
  const edit = (id: string, body: unknown, as: "ops-all" | "ops-a" = "ops-all") =>
    admin(app.app, "PUT", `/v1/admin/merchants/${id}/profile`, { as, body });

  it("a creation with a name and a URL answers them, and every reading carries them as written", async () => {
    const res = await admin(app.app, "POST", "/v1/admin/merchants", {
      body: {
        origins: ["https://norte.example"],
        signature: false,
        displayName: "Tienda Norte",
        storeUrl: "https://www.norte.example/es/",
      },
    });
    expect(res.statusCode, res.body).toBe(201);
    const { merchant } = json(res) as { merchant: Identified };
    expect(merchant).toMatchObject({
      displayName: "Tienda Norte",
      storeUrl: "https://www.norte.example/es/",
    });
    expect(merchant).not.toHaveProperty("contact");
    expect(await read(merchant.merchantId)).toMatchObject({
      displayName: "Tienda Norte",
      storeUrl: "https://www.norte.example/es/",
    });
    expect(await listed(merchant.merchantId)).toMatchObject({ displayName: "Tienda Norte" });
  });

  it("a creation without a name is refused by the contract, naming the field, and creates nothing", async () => {
    const before = (json(await admin(app.app, "GET", "/v1/admin/merchants")) as { items: unknown[] }).items
      .length;
    const res = await admin(app.app, "POST", "/v1/admin/merchants", {
      body: { origins: ["https://nameless.example"], signature: false },
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.stringify(problemOf(res).errors)).toContain("displayName");
    const after = (json(await admin(app.app, "GET", "/v1/admin/merchants")) as { items: unknown[] }).items
      .length;
    expect(after).toBe(before);
  });

  it("[invariant:invalid-merchant-profile] a padded name at creation, and a URL that only looks like one at edition, name their field under /body", async () => {
    const padded = await admin(app.app, "POST", "/v1/admin/merchants", {
      body: { origins: ["https://pad.example"], signature: false, displayName: " Tienda " },
    });
    expect(padded.statusCode).toBe(422);
    expect(problemOf(padded)).toMatchObject({
      type: "urn:ope:problem:invalid-merchant-profile",
      errors: [{ pointer: "/body/displayName" }],
    });
    expect(await admin(app.app, "GET", "/v1/admin/merchants").then((r) => r.body)).not.toContain(
      "pad.example",
    );
    const created = await create();
    const url = await edit(created.merchant.merchantId, { displayName: "X", storeUrl: "https://" });
    expect(url.statusCode).toBe(422);
    expect(problemOf(url)).toMatchObject({
      type: "urn:ope:problem:invalid-merchant-profile",
      errors: [
        { pointer: "/body/storeUrl", message: "The store URL must parse as an absolute http(s) URL." },
      ],
    });
    expect((await read(created.merchant.merchantId)).displayName).toBe("Nueva");
  });

  it("the edition replaces the identity whole and touches nothing else; a field left out is cleared", async () => {
    const created = await create();
    const full = await edit(created.merchant.merchantId, identity);
    expect(full.statusCode, full.body).toBe(200);
    expect(json(full)).toMatchObject({ ...created.merchant, ...identity });
    const back = await read(created.merchant.merchantId);
    expect(back).toMatchObject(identity);
    expect(back.origins).toEqual(created.merchant.origins);
    expect(back.credentials).toEqual(created.merchant.credentials);
    expect(back.status).toBe("active");
    const less = await edit(created.merchant.merchantId, {
      displayName: "Tienda Norte SA",
      notes: "Renamed.",
    });
    expect(less.statusCode).toBe(200);
    const after = await read(created.merchant.merchantId);
    expect(after).toMatchObject({ displayName: "Tienda Norte SA", notes: "Renamed." });
    expect(after).not.toHaveProperty("storeUrl");
    expect(after).not.toHaveProperty("contact");
  });

  it("a merchant of the seed has no identity until an operator names it; a body with origins is refused", async () => {
    expect(await read("m_b")).not.toHaveProperty("displayName");
    const named = await edit("m_b", { displayName: "Tienda B" });
    expect(named.statusCode, named.body).toBe(200);
    expect((await read("m_b")).displayName).toBe("Tienda B");
    const extra = await edit("m_b", { displayName: "Tienda B", origins: ["https://x.example"] });
    expect(extra.statusCode).toBe(400);
    const nameless = await edit("m_b", { notes: "nameless" });
    expect(nameless.statusCode).toBe(400);
  });

  it("a deactivated merchant admits the edition", async () => {
    const created = await create(["https://cerrada.example"]);
    expect(
      (await admin(app.app, "POST", `/v1/admin/merchants/${created.merchant.merchantId}/deactivate`))
        .statusCode,
    ).toBe(200);
    const res = await edit(created.merchant.merchantId, { displayName: "Cerrada" });
    expect(res.statusCode, res.body).toBe(200);
    expect(json(res)).toMatchObject({ status: "deactivated", displayName: "Cerrada" });
  });

  it("an operator outside the scope gets 403 with the same body as for a merchant that does not exist, and the identity does not change", async () => {
    const onB = await edit("m_b", identity, "ops-a");
    const onNobody = await edit("mrc_nobody000000", identity, "ops-a");
    expect([onB.statusCode, onNobody.statusCode]).toEqual([403, 403]);
    const strip = (r: typeof onB) => ({ ...problemOf(r), instance: undefined, requestId: undefined });
    expect(strip(onB)).toEqual(strip(onNobody));
    expect(problemOf(onB).type).toBe("urn:ope:problem:merchant-out-of-scope");
    expect(await read("m_b")).not.toHaveProperty("contact");
    expect((await edit("m_a", { displayName: "Tienda A" }, "ops-a")).statusCode).toBe(200);
  });

  it("the edition is audited without any of the values written", async () => {
    const created = await create();
    expect((await edit(created.merchant.merchantId, identity)).statusCode).toBe(200);
    const res = await admin(app.app, "GET", `/v1/admin/merchants/${created.merchant.merchantId}/log`);
    const log = json(res) as { items: { operation: string; operatorId: string; outcome: string }[] };
    expect(log.items[0]).toMatchObject({
      operation: "updateMerchantProfile",
      operatorId: "ops-all",
      outcome: "accepted",
    });
    for (const word of ["Tienda Norte", "Ana", "ana@norte.example", "5555", "Pilot"]) {
      expect(res.body).not.toContain(word);
    }
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
    await app.resetPorts({ ports: [replace(ClockPort, fixedClock("2026-09-21T00:00:00.000Z"))] });
    const created = await create(["https://t.example"], false);
    expect(created.merchant.credentials[0]?.issuedAt).toBe("2026-09-21T00:00:00.000Z");
  });
});
