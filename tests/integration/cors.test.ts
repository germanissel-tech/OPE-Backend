// US5 (FR-040; ADR-014): only the merchant's store can talk to the backend from the browser.
// The preflight accepts any registered origin (it carries no credential); the real request
// demands the pair credential + origin.
import { afterEach, describe, expect, it } from "vitest";
import { problemOf } from "../helpers/json.js";
import { batchOf, postEvents, startTestApp } from "../helpers/test-app.js";
import type { App } from "../../src/composition/bootstrap.js";

let app: App | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

const preflight = (a: App, origin: string) =>
  a.app.inject({
    method: "OPTIONS",
    url: "/v1/events",
    headers: {
      origin,
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type, x-ope-ingest-key",
    },
  });

describe("origins per merchant", () => {
  it("preflight from a registered origin → 204 with Allow-Origin, the method and the key header", async () => {
    app = await startTestApp();
    const res = await preflight(app, "https://a.example");
    expect(res.statusCode).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("https://a.example");
    expect(String(res.headers["access-control-allow-methods"])).toContain("POST");
    expect(String(res.headers["access-control-allow-headers"]).toLowerCase()).toContain("x-ope-ingest-key");
  });

  it("preflight from an origin no merchant registered → no Allow-Origin", async () => {
    app = await startTestApp();
    const res = await preflight(app, "https://nadie.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("the preflight does not land on the contract wildcard route (no 405)", async () => {
    app = await startTestApp();
    const res = await preflight(app, "https://b.example");
    expect(res.statusCode).not.toBe(405);
    expect(res.statusCode).toBe(204);
  });

  it("[invariant:origin-not-allowed] key of one merchant with the Origin of another → 403", async () => {
    app = await startTestApp();
    const res = await postEvents(app.app, batchOf(1), { key: "key-a-1", origin: "https://b.example" });
    expect(res.statusCode).toBe(403);
    expect(problemOf(res)).toMatchObject({ type: "urn:ope:problem:origin-not-allowed", status: 403 });
  });

  it("key and Origin of the same merchant → passes security and carries Allow-Origin in the response", async () => {
    app = await startTestApp();
    const res = await postEvents(app.app, batchOf(1), { key: "key-a-1", origin: "https://a.example" });
    expect([401, 403]).not.toContain(res.statusCode);
    expect(res.headers["access-control-allow-origin"]).toBe("https://a.example");
  });

  it("without Origin (server to server, tests) it is processed normally", async () => {
    app = await startTestApp();
    const res = await postEvents(app.app, batchOf(1), { key: "key-a-1" });
    expect([401, 403]).not.toContain(res.statusCode);
  });

  it("enables neither browser credentials (cookies) nor wildcard origins", async () => {
    app = await startTestApp();
    const res = await preflight(app, "https://a.example");
    expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
    expect(res.headers["access-control-allow-origin"]).not.toBe("*");
  });
});
