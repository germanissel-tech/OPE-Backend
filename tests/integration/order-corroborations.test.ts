// Feature 013, user story 3 (FR-030..FR-033): the SDK corroborates a purchase from the
// confirmation page — evidence under the credential's merchant, never an order, never an
// attribution; joined to the order by identity in whatever order they arrive.
import { afterEach, describe, expect, it } from "vitest";
import { json } from "../helpers/json.js";
import {
  eventOf,
  fixedClock,
  orderOf,
  postCorroboration,
  postEvents,
  postOrder,
  startTestApp,
} from "../helpers/test-app.js";
import { unavailableCorroborationLedger } from "../helpers/unavailable-ledgers.js";
import type { App } from "../../src/composition/bootstrap.js";
import type { OrderId } from "../../src/domain/outcomes/index.js";
import type { MerchantId } from "../../src/domain/shared-kernel/index.js";

const NOW = "2026-09-18T12:00:00.000Z";
const KEY_A = "key-a-1";
const KEY_B = "key-b-1";
const PLATFORM_A = "platform-a-1";
const SESSION = "ses_00000001";
const A = "m_a" as MerchantId;
const B = "m_b" as MerchantId;

const corroboration = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  orderId: "A-1",
  sessionId: SESSION,
  visitorId: "vis_00000001",
  confirmedAt: "2026-09-18T11:59:58.000Z",
  ...over,
});

let app: App;
afterEach(async () => {
  await app.close();
});

async function start(options: { down?: boolean } = {}): Promise<void> {
  app = await startTestApp({
    ports: {
      clock: fixedClock(NOW),
      ...(options.down ? { corroborations: unavailableCorroborationLedger() } : {}),
    },
  });
}

const found = (merchant: MerchantId, orderId: string) =>
  app.ports.corroborations.find(merchant, orderId as OrderId);
const order = (merchant: MerchantId, orderId: string) => app.ports.orders.find(merchant, orderId as OrderId);

describe("corroborateOrder — user story 3", () => {
  it("1. before the order: 202, the corroboration is recorded and no order exists", async () => {
    await start();
    await postEvents(
      app.app,
      { events: [eventOf(1, { occurredAt: "2026-09-18T11:59:00.000Z" })] },
      { key: KEY_A },
    );
    const res = await postCorroboration(app.app, corroboration(), { key: KEY_A });
    expect(res.statusCode).toBe(202);
    expect(json(res)).toEqual({ orderId: "A-1", receivedAt: NOW });
    expect(await found(A, "A-1")).toMatchObject([
      {
        merchantId: A,
        orderId: "A-1",
        sessionId: SESSION,
        visitorId: "vis_00000001",
        receivedAt: new Date(NOW),
      },
    ]);
    expect(await order(A, "A-1")).toBeUndefined();
  });

  it("2. then the order arrives: its status is decided by mechanism A alone; both are found by the same identity", async () => {
    await start();
    await postCorroboration(app.app, corroboration(), { key: KEY_A });
    const res = await postOrder(app.app, orderOf("A-1"), { platformKey: PLATFORM_A });
    expect(json(res)).toMatchObject({ status: "PENDING_CORRELATION" });
    expect(await order(A, "A-1")).toBeDefined();
    expect(await found(A, "A-1")).toHaveLength(1);
  });

  it("3. after the order: the corroboration links by identity and the order does not change", async () => {
    await start();
    await postEvents(
      app.app,
      { events: [eventOf(1, { occurredAt: "2026-09-18T11:59:00.000Z" })] },
      { key: KEY_A },
    );
    await postOrder(app.app, orderOf("A-1", { sessionId: SESSION }), { platformKey: PLATFORM_A });
    const before = await order(A, "A-1");
    const res = await postCorroboration(app.app, corroboration(), { key: KEY_A });
    expect(res.statusCode).toBe(202);
    expect(await order(A, "A-1")).toBe(before);
    expect(await found(A, "A-1")).toHaveLength(1);
  });

  it("4. repeated: 202 and a single record; another session of the same order is another record", async () => {
    await start();
    expect((await postCorroboration(app.app, corroboration(), { key: KEY_A })).statusCode).toBe(202);
    expect((await postCorroboration(app.app, corroboration(), { key: KEY_A })).statusCode).toBe(202);
    expect(await found(A, "A-1")).toHaveLength(1);
    await postCorroboration(app.app, corroboration({ sessionId: "ses_00000002" }), { key: KEY_A });
    expect(await found(A, "A-1")).toHaveLength(2);
  });

  it("5. a session of another merchant: recorded under the credential's merchant, linked to nothing of the other", async () => {
    await start();
    await postEvents(
      app.app,
      { events: [eventOf(1, { occurredAt: "2026-09-18T11:59:00.000Z" })] },
      { key: KEY_B },
    );
    await postCorroboration(app.app, corroboration(), { key: KEY_A });
    expect(await found(A, "A-1")).toHaveLength(1);
    expect(await found(B, "A-1")).toHaveLength(0);
  });

  it("6. ledger unavailable → 503 with Retry-After", async () => {
    await start({ down: true });
    const res = await postCorroboration(app.app, corroboration(), { key: KEY_A });
    expect(res.statusCode).toBe(503);
    expect(res.headers["retry-after"]).toBeDefined();
  });

  it("[invariant:corroboration-confirmed-in-future] a browser clock more than 5 minutes ahead → 422", async () => {
    await start();
    const res = await postCorroboration(app.app, corroboration({ confirmedAt: "2026-09-18T12:05:01.000Z" }), {
      key: KEY_A,
    });
    expect(res.statusCode).toBe(422);
    expect(json(res)).toMatchObject({ type: "urn:ope:problem:corroboration-confirmed-in-future" });
    expect(await found(A, "A-1")).toHaveLength(0);
  });

  it("[invariant:origin-not-allowed] an Origin the merchant did not register → 403; the platform key is not accepted", async () => {
    await start();
    const wrongOrigin = await postCorroboration(app.app, corroboration(), {
      key: KEY_A,
      origin: "https://evil.example",
    });
    expect(wrongOrigin.statusCode).toBe(403);
    expect((await postCorroboration(app.app, corroboration(), { platformKey: PLATFORM_A })).statusCode).toBe(
      401,
    );
  });
});
