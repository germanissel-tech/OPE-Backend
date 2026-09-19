// Feature 013, user story 6 (FR-050..FR-053; SC-004, SC-005; ADR-029): through HTTP, a merchant
// with a signing secret is served only when the platform signed the bytes it sent within the
// window; a merchant without one keeps working with the key alone; the catalogue is signed too.
import { afterEach, describe, expect, it } from "vitest";
import { json } from "../helpers/json.js";
import { signed } from "../helpers/sign.js";
import { catalogOf, fixedClock, orderOf, startTestApp, type MerchantSpec } from "../helpers/test-app.js";
import { recordingLogger } from "../helpers/unavailable-ledgers.js";
import type { App } from "../../src/composition/bootstrap.js";

const NOW = "2026-09-18T12:00:00.000Z";
const SECRET = "secret-s-1";
const SECRET_2 = "secret-s-2";
const PLATFORM_S = "platform-s-1";
const PLATFORM_A = "platform-a-1";

/** A merchant whose platform must sign, next to A, who has no secret. */
const signing: MerchantSpec = {
  merchantId: "m_s",
  ingestKeys: ["key-s-1"],
  platformKeys: [PLATFORM_S],
  platformSecrets: [SECRET, SECRET_2],
  origins: ["https://s.example"],
  experiments: [],
};
const plain: MerchantSpec = {
  merchantId: "m_a",
  ingestKeys: ["key-a-1"],
  platformKeys: [PLATFORM_A],
  origins: ["https://a.example"],
  experiments: [],
};

let app: App;
afterEach(async () => {
  await app.close();
});

const body = JSON.stringify(orderOf("S-1"));
const at = (iso: string) => new Date(iso);

async function post(url: string, payload: string, headers: Record<string, string>, platformKey = PLATFORM_S) {
  return app.app.inject({
    method: url === "/v1/catalog" ? "PUT" : "POST",
    url,
    headers: { "content-type": "application/json", "x-ope-platform-key": platformKey, ...headers },
    payload,
  });
}

describe("platform signature — user story 6", () => {
  it("1. signed with a secret of the merchant, within the window → accepted", async () => {
    app = await startTestApp({ ports: { clock: fixedClock(NOW) } }, { merchants: [signing, plain] });
    const res = await post("/v1/orders", body, signed(body, SECRET, at(NOW)));
    expect(res.statusCode).toBe(201);
    expect(json(res)).toMatchObject({ orderId: "S-1" });
  });

  it("2. without the headers, with a wrong secret, a tampered body, a malformed signature or out of the window → 401 with its own type; nothing recorded", async () => {
    app = await startTestApp({ ports: { clock: fixedClock(NOW) } }, { merchants: [signing, plain] });
    const good = signed(body, SECRET, at(NOW));
    const cases: [string, string, Record<string, string>, string][] = [
      ["no headers", body, {}, "signature-missing"],
      ["only the timestamp", body, { "x-ope-timestamp": good["x-ope-timestamp"] ?? "" }, "signature-missing"],
      ["only the signature", body, { "x-ope-signature": good["x-ope-signature"] ?? "" }, "signature-missing"],
      ["another secret", body, signed(body, "not-the-secret", at(NOW)), "signature-invalid"],
      [
        "a body tampered after signing",
        JSON.stringify(orderOf("S-1", { total: { amount: "1.00", currency: "ARS" } })),
        good,
        "signature-invalid",
      ],
      ["a malformed signature", body, { ...good, "x-ope-signature": "sha256=abc" }, "signature-invalid"],
      ["a non-numeric timestamp", body, { ...good, "x-ope-timestamp": "now" }, "signature-invalid"],
      ["ten minutes ago", body, signed(body, SECRET, at("2026-09-18T11:50:00.000Z")), "signature-expired"],
      ["ten minutes ahead", body, signed(body, SECRET, at("2026-09-18T12:10:00.000Z")), "signature-expired"],
    ];
    for (const [name, payload, headers, type] of cases) {
      const res = await post("/v1/orders", payload, headers);
      expect(res.statusCode, name).toBe(401);
      expect(json(res), name).toMatchObject({ type: `urn:ope:problem:${type}`, status: 401 });
    }
    expect(await app.ports.orders.find("m_s" as never, "S-1" as never)).toBeUndefined();
  });

  it("3. a rotation: the second secret is accepted too", async () => {
    app = await startTestApp({ ports: { clock: fixedClock(NOW) } }, { merchants: [signing, plain] });
    expect((await post("/v1/orders", body, signed(body, SECRET_2, at(NOW)))).statusCode).toBe(201);
  });

  it("4. a merchant without a secret is served with the key alone, with or without signature headers", async () => {
    app = await startTestApp({ ports: { clock: fixedClock(NOW) } }, { merchants: [signing, plain] });
    expect((await post("/v1/orders", body, {}, PLATFORM_A)).statusCode).toBe(201);
    const again = JSON.stringify(orderOf("S-2"));
    expect((await post("/v1/orders", again, signed(again, "anything", at(NOW)), PLATFORM_A)).statusCode).toBe(
      201,
    );
  });

  it("5. the signature is of the credential, not of the operation: the catalogue and the returns are signed too", async () => {
    app = await startTestApp({ ports: { clock: fixedClock(NOW) } }, { merchants: [signing, plain] });
    const catalog = JSON.stringify(catalogOf(1, NOW));
    expect((await post("/v1/catalog", catalog, {})).statusCode).toBe(401);
    expect((await post("/v1/catalog", catalog, signed(catalog, SECRET, at(NOW)))).statusCode).toBe(201);
    await post("/v1/orders", body, signed(body, SECRET, at(NOW)));
    const ret = JSON.stringify({ orderId: "S-1", returnedAt: NOW });
    expect((await post("/v1/returns", ret, {})).statusCode).toBe(401);
    expect((await post("/v1/returns", ret, signed(ret, SECRET, at(NOW)))).statusCode).toBe(201);
  });

  it("the signature is checked before the body: an invalid body with a bad signature is 401, with a good one 400; the wrong consumer is still 403 after the key", async () => {
    app = await startTestApp({ ports: { clock: fixedClock(NOW) } }, { merchants: [signing, plain] });
    const invalid = JSON.stringify({ orderId: "S-9" });
    expect((await post("/v1/orders", invalid, {})).statusCode).toBe(401);
    expect((await post("/v1/orders", invalid, signed(invalid, SECRET, at(NOW)))).statusCode).toBe(400);
  });

  it("neither the secret nor the signature reach the logs or the responses (SC-004)", async () => {
    const { logger, entries } = recordingLogger();
    app = await startTestApp({ ports: { clock: fixedClock(NOW), logger } }, { merchants: [signing, plain] });
    const headers = signed(body, SECRET, at(NOW));
    const ok = await post("/v1/orders", body, headers);
    const bad = await post("/v1/orders", body, {});
    const everything = JSON.stringify(entries) + ok.body + bad.body;
    expect(everything).not.toContain(SECRET);
    expect(everything).not.toContain(headers["x-ope-signature"] ?? "v1=");
  });
});
