// Publishing level 1 by API (feature 036, US3), and **one case per value** (SC-001).
//
// **What this suite is really about is that nothing is baked at boot any more.** Eleven components of five
// modules used to receive a number of level 1 when the server was built — the deduplication window, the two
// clock tolerances, the signature window, the rotation grace, the two retention caps, the visitor window,
// the duration of a session, the identity cap and the `Retry-After` of every 503 — so publishing a version
// would have changed the stored level and nothing else until a restart. Each case here publishes a value and
// observes its effect **over HTTP, without restarting**.
//
// Two of the values have no effect that shows without moving the clock past an expiry (the TTL of the
// deduplication window and the visitor window), and one caps a log of the catalogue. Their case asserts that
// the level in force serves them and says where the expiry itself is proven; inventing an HTTP effect for
// them would be a test about this file rather than about the system.
//
// **And the freeze of level 1 is not the freeze of level 2** (US3, scenario 4). Five of its fields decide
// what is counted and the other five are operational, so publishing a `Retry-After` while an experiment runs
// is not a corrective version and restarts nothing. The last two cases are that distinction.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { replace } from "../../src/composition/graph/index.js";
import { CatalogStorePort } from "../../src/composition/modules/catalog.js";
import { ClockPort } from "../../src/composition/modules/shared-kernel.js";
import { json, problemOf } from "../helpers/json.js";
import {
  admin,
  catalogOf,
  eventOf,
  fixedClock,
  NOW,
  postEvents,
  putCatalog,
  sharedTestApp,
  type SharedApp,
} from "../helpers/test-app.js";
import { unavailableCatalogStore } from "../helpers/unavailable-ledgers.js";

const URL = "/v1/admin/platform-configuration";
const PLATFORM_A = "platform-a-1";
const CAPTURED = "2026-09-18T11:59:00.000Z";
const MINUTE_MS = 60_000;
/** An instant `ms` away from the fixed clock of the test app. */
const at = (ms: number): string => new Date(Date.parse(NOW) + ms).toISOString();

let app: SharedApp;

beforeEach(async () => {
  app = await sharedTestApp({ ports: [replace(ClockPort, fixedClock())] });
  await app.resetPorts();
});

afterEach(async () => {
  await app.close();
});

/** What level 1 holds now, without the name minted from its number: the body a panel would send back. */
async function contentInForce(): Promise<Record<string, unknown>> {
  const read = json(await admin(app.app, "GET", URL)) as Record<string, unknown>;
  const { version, ...content } = read;
  expect(version).toBe("platform-1");
  return content;
}

/** Publishes level 1 with some values changed, and answers the number of the version it created. */
async function publish(over: Record<string, unknown>, reason?: string): Promise<number> {
  const content = { ...(await contentInForce()), ...over };
  const body = reason === undefined ? { content } : { content, corrective: true, reason };
  const response = await admin(app.app, "POST", URL, { body });
  expect(response.statusCode).toBe(201);
  return (json(response) as { version: number }).version;
}

/** The only read of this level the API has, which is also what the SDK quotes as `versions.platform`. */
const inForce = async (): Promise<Record<string, unknown>> =>
  json(await admin(app.app, "GET", URL)) as Record<string, unknown>;

describe("publishing the platform configuration (US3)", () => {
  it("numbers the version, serves it on the next read and mints its name from the number", async () => {
    const version = await publish({ retryAfterSeconds: 9 });

    expect(version).toBe(2);
    const read = await inForce();
    expect(read["version"]).toBe("platform-2");
    expect(read["retryAfterSeconds"]).toBe(9);
  });

  it("repeats the version in force when the content is identical, instead of creating another", async () => {
    const again = await admin(app.app, "POST", URL, { body: { content: await contentInForce() } });

    expect(again.statusCode).toBe(200);
    expect(json(again)).toMatchObject({ version: 1, stampedAs: "platform-1" });
  });

  it("refuses a value out of range before anything is judged, and creates no version", async () => {
    // **The 400 and not the 422, and that is worth saying.** For level 1 the ranges of the contract are the
    // ranges of the entity —every field is a whole number with the same bounds in both— so what the reader
    // would refuse the schema refuses first. The operation still declares its `422`: the reader is the
    // authority, and the day one of those bounds moves in the entity alone, that is what answers.
    const content = { ...(await contentInForce()), signatureWindowMs: 0 };
    const response = await admin(app.app, "POST", URL, { body: { content } });

    expect(response.statusCode).toBe(400);
    expect((await inForce())["version"]).toBe("platform-1");
  });

  it("refuses an operator whose scope is a list, because the change reaches every merchant", async () => {
    const content = await contentInForce();
    const response = await admin(app.app, "POST", URL, { body: { content }, as: "ops-a" });

    expect(response.statusCode).toBe(403);
    expect(problemOf(response).type).toBe("urn:ope:problem:operator-scope-too-narrow");
  });
});

describe("[SC-001] each value of level 1 takes effect without a restart", () => {
  it("dedupWindow.maxIds: a cap of one forgets the previous id, so the same event enters again", async () => {
    // The effect of the window that does not need the clock: with room for one id, claiming a second one
    // evicts the first, and an event already absorbed is absorbed again.
    const first = await postEvents(app.app, { events: [eventOf(1)] }, { key: "key-a-1" });
    expect(json(first)).toMatchObject({ accepted: 1, duplicates: 0 });
    const repeated = await postEvents(app.app, { events: [eventOf(1)] }, { key: "key-a-1" });
    expect(json(repeated)).toMatchObject({ accepted: 0, duplicates: 1 });

    await publish({ dedupWindow: { ttlMs: 86_400_000, maxIds: 1 } }, "the window was too wide");

    // Another id takes the only place, and then the first one is new again: the window published a moment
    // ago is the one the ingest obeys.
    await postEvents(app.app, { events: [eventOf(2)] }, { key: "key-a-1" });
    const again = await postEvents(app.app, { events: [eventOf(1)] }, { key: "key-a-1" });
    expect(json(again)).toMatchObject({ accepted: 1, duplicates: 0 });
  });

  it("clockSkewToleranceMs: an instant in the future the tolerance no longer admits is refused", async () => {
    const ahead = { events: [eventOf(1, { occurredAt: at(MINUTE_MS) })] };
    expect((await postEvents(app.app, ahead, { key: "key-a-1" })).statusCode).toBe(202);

    await publish({ clockSkewToleranceMs: 0 }, "no clock skew while we measure");

    const refused = await postEvents(
      app.app,
      { events: [eventOf(2, { occurredAt: at(MINUTE_MS) })] },
      {
        key: "key-a-1",
      },
    );
    expect(refused.statusCode).toBe(422);
    expect(problemOf(refused).type).toBe("urn:ope:problem:event-timestamp-out-of-range");
  });

  it("eventPastToleranceMs: a late upload the tolerance no longer admits is refused", async () => {
    const old = { events: [eventOf(1, { occurredAt: at(-60 * MINUTE_MS) })] };
    expect((await postEvents(app.app, old, { key: "key-a-1" })).statusCode).toBe(202);

    await publish({ eventPastToleranceMs: 1_000 }, "late uploads stop counting");

    const refused = await postEvents(
      app.app,
      { events: [eventOf(2, { occurredAt: at(-60 * MINUTE_MS) })] },
      { key: "key-a-1" },
    );
    expect(refused.statusCode).toBe(422);
    expect(problemOf(refused).type).toBe("urn:ope:problem:event-timestamp-out-of-range");
  });

  it("anchorDiagnosticsKept: a cap of one keeps the newest report and drops the other", async () => {
    await publish({ anchorDiagnosticsKept: 1 });
    const report = (anchor: string) =>
      app.app.inject({
        method: "POST",
        url: "/v1/sdk/diagnostics",
        headers: { "x-ope-ingest-key": "key-a-1", "content-type": "application/json" },
        payload: { unresolved: [{ anchor, pageType: "product" }] },
      });

    await report("cta");
    await report("price");

    const page = json(await admin(app.app, "GET", "/v1/admin/merchants/m_a/anchor-diagnostics")) as {
      items: { anchor: string }[];
    };
    expect(page.items.map((d) => d.anchor)).toEqual(["price"]);
  });

  it("rotationGraceMaxMs: a grace longer than the level admits stops being accepted", async () => {
    const rotate = (graceSeconds: number) =>
      admin(app.app, "POST", "/v1/admin/merchants/m_a/ingest-keys", { body: { graceSeconds } });
    expect((await rotate(60)).statusCode).toBe(201);

    await publish({ rotationGraceMaxMs: 1_000 });

    const refused = await rotate(60);
    expect(refused.statusCode).toBe(422);
    expect(problemOf(refused).type).toBe("urn:ope:problem:rotation-grace-too-long");
  });

  it("retryAfterSeconds: the next 503 carries the number that was just published", async () => {
    // **The whole chain in one case**: the value travels from the published level to a header the transport
    // adds, which is the furthest from the configuration any of these values gets — and the one the old
    // wiring read once, when the server was built.
    //
    // The reset comes first on purpose: it rebuilds the in-memory components and re-imports the seed, so a
    // version published before it would not survive it.
    await app.resetPorts({ ports: [replace(CatalogStorePort, unavailableCatalogStore())] });
    await publish({ retryAfterSeconds: 11 });

    const refused = await putCatalog(app.app, catalogOf(1, CAPTURED), { platformKey: PLATFORM_A });

    expect(refused.statusCode).toBe(503);
    expect(refused.headers["retry-after"]).toBe("11");
  });

  it("the three values whose effect needs the clock moved are served by the level in force", async () => {
    // `dedupWindow.ttlMs` and `visitorWindowMs` only show when something expires —
    // `tests/durability/event-dedup.test.ts` and the state suites move the clock for that — and
    // `unmappedValuesKept` caps a log of the catalogue (`tests/integration/unmapped-attribute-values.test.ts`).
    // What this case adds is that a publication of the three is in force at once, under one version.
    await publish(
      { dedupWindow: { ttlMs: 1_000, maxIds: 50 }, visitorWindowMs: 2_000, unmappedValuesKept: 3 },
      "the windows were measured wrong",
    );

    const read = await inForce();
    expect(read["dedupWindow"]).toEqual({ ttlMs: 1_000, maxIds: 50 });
    expect(read["visitorWindowMs"]).toBe(2_000);
    expect(read["unmappedValuesKept"]).toBe(3);
    expect(read["version"]).toBe("platform-2");
  });

  it("sessionDurationMs: what the SDK receives keeps its shape and quotes the new version (FR-017)", async () => {
    const sdkConfig = () =>
      app.app.inject({ method: "GET", url: "/v1/sdk/config", headers: { "x-ope-ingest-key": "key-a-1" } });
    const before = json(await sdkConfig()) as { versions: { platform: string } };
    expect(before.versions.platform).toBe("platform-1");

    await publish({ sessionDurationMs: 600_000 }, "sessions were too long");

    const after = json(await sdkConfig()) as Record<string, unknown>;
    // The same keys, which is what FR-017 asks: what changes is the version quoted, not the shape.
    expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
    expect((after["versions"] as { platform: string }).platform).toBe("platform-2");
  });
});

describe("[US3 scenario 4] only the fields that govern the measurement freeze", () => {
  /** The seed of `m_a` opens its experiment already active; saying so beats depending on the seed. */
  async function activate(): Promise<void> {
    const response = await admin(
      app.app,
      "POST",
      "/v1/admin/merchants/m_a/experiments/exp_a_000001/activate",
    );
    expect(response.statusCode).toBe(200);
  }

  it("refuses a change of a measuring field without a reason while an experiment is active", async () => {
    await activate();
    const content = { ...(await contentInForce()), sessionDurationMs: 600_000 };

    const response = await admin(app.app, "POST", URL, { body: { content } });

    expect(response.statusCode).toBe(409);
    expect(problemOf(response).type).toBe("urn:ope:problem:configuration-frozen");
  });

  it("accepts an operational field with no reason at all, and restarts no window", async () => {
    // **The case that keeps the rule defensible.** `retryAfterSeconds` does not change what is counted, so
    // freezing it behind a running experiment would be a rule nobody could explain — and restarting the
    // window for it would destroy the measurement the freeze exists to protect.
    await activate();
    const content = { ...(await contentInForce()), retryAfterSeconds: 7 };

    const response = await admin(app.app, "POST", URL, { body: { content } });

    expect(response.statusCode).toBe(201);
    expect(json(response)).not.toHaveProperty("windowsRestarted");
  });

  it("restarts the window of the reached experiment when the reason is there", async () => {
    await activate();
    const content = { ...(await contentInForce()), visitorWindowMs: 3_000 };

    const response = await admin(app.app, "POST", URL, {
      body: { content, corrective: true, reason: "the fatigue window was wrong" },
    });

    expect(response.statusCode).toBe(201);
    expect(json(response)).toMatchObject({ windowsRestarted: ["exp_a_000001"] });
  });
});

describe("the witness of a level (feature 043)", () => {
  const DEFAULTS = "/v1/admin/treatment-defaults";
  const read = async (url = URL) => {
    const response = await admin(app.app, "GET", url);
    const etag = response.headers.etag;
    expect(typeof etag).toBe("string");
    const { version, ...content } = json(response) as Record<string, unknown>;
    expect(version).toBeDefined();
    return { etag: String(etag), content };
  };
  const send = (body: unknown, ifMatch: string | null, url = URL) =>
    admin(app.app, "POST", url, { body, ifMatch });

  it("a read hands out the witness, and a write with it is accepted and hands out the next one", async () => {
    const { etag, content } = await read();
    expect(etag).toBe('"platform-1"');

    const published = await send({ content: { ...content, retryAfterSeconds: 7 } }, etag);
    expect(published.statusCode).toBe(201);
    expect(published.headers.etag).toBe('"platform-2"');
    expect((await read()).etag).toBe('"platform-2"');
  });

  it("[invariant:stale-version] a write with a witness somebody wrote over is refused, and nothing is written", async () => {
    const { etag, content } = await read();
    expect((await send({ content: { ...content, retryAfterSeconds: 7 } }, etag)).statusCode).toBe(201);

    const late = await send({ content: { ...content, retryAfterSeconds: 9 } }, etag);
    expect(late.statusCode).toBe(412);
    expect(problemOf(late).type).toBe("urn:ope:problem:stale-version");
    expect(late.headers.etag).toBeUndefined();
    expect((await inForce())["retryAfterSeconds"]).toBe(7);
  });

  it("repeating a write that went through answers what is in force, with the witness of before", async () => {
    const { etag, content } = await read();
    const body = { content: { ...content, retryAfterSeconds: 7 } };
    expect((await send(body, etag)).statusCode).toBe(201);

    const again = await send(body, etag);
    expect(again.statusCode).toBe(200);
    expect(json(again)).toMatchObject({ version: 2 });
    expect(again.headers.etag).toBe('"platform-2"');
  });

  it("without a witness the write is 428, without the current one, and nothing is written", async () => {
    const { content } = await read();

    const blind = await send({ content: { ...content, retryAfterSeconds: 7 } }, null);
    expect(blind.statusCode).toBe(428);
    expect(problemOf(blind).type).toBe("urn:ope:problem:witness-required");
    expect(blind.headers.etag).toBeUndefined();
    expect((await inForce())["version"]).toBe("platform-1");
    // A request that is also malformed is answered as malformed: the witness alone would not fix it.
    expect((await send({ content: {} }, null)).statusCode).toBe(400);
  });

  it("a witness of the other level, the wildcard or a weak one never match", async () => {
    const defaults = await read(DEFAULTS);
    expect(defaults.etag).toBe('"defaults-1"');
    const { etag, content } = await read();
    const body = { content: { ...content, retryAfterSeconds: 7 } };
    for (const wrong of [defaults.etag, "*", `W/${etag}`, etag.replaceAll('"', "")]) {
      expect((await send(body, wrong)).statusCode).toBe(412);
    }
    expect((await send(body, etag)).statusCode).toBe(201);
  });
});
