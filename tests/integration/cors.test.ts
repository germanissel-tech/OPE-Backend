// Feature 004, US5 (FR-040; ADR-014): only the merchant's store can talk to the backend from the browser.
// The preflight accepts any registered origin (it carries no credential); the real request
// demands the pair credential + origin.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { problemOf } from "../helpers/json.js";
import { batchOf, postEvents, sharedTestApp, type SharedApp } from "../helpers/test-app.js";

// One server per file (015 F-055): the in-memory ports are rebuilt before each test.
let app: SharedApp;
beforeAll(async () => {
  app = await sharedTestApp();
});
beforeEach(async () => {
  await app.resetPorts();
});
afterAll(async () => {
  await app.close();
});

const preflight = (
  a: SharedApp,
  origin: string,
  requested = "content-type, x-ope-ingest-key",
  url = "/v1/events",
) =>
  a.app.inject({
    method: "OPTIONS",
    url,
    headers: {
      origin,
      "access-control-request-method": "POST",
      "access-control-request-headers": requested,
    },
  });

describe("origins per merchant", () => {
  it("preflight from a registered origin → 204 with Allow-Origin, the method and the key header", async () => {
    const res = await preflight(app, "https://a.example");
    expect(res.statusCode).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("https://a.example");
    expect(String(res.headers["access-control-allow-methods"])).toContain("POST");
    expect(String(res.headers["access-control-allow-headers"]).toLowerCase()).toContain("x-ope-ingest-key");
  });

  it("the platform credential is never announced to a browser: a preflight asking for it gets only the ingest header (ADR-025 §5, F-051)", async () => {
    const asked = "content-type, x-ope-platform-key, x-ope-timestamp, x-ope-signature";
    for (const url of ["/v1/orders", "/v1/returns", "/v1/catalog"]) {
      const res = await preflight(app, "https://a.example", asked, url);
      const allowed = (res.headers["access-control-allow-headers"] ?? "").toLowerCase();
      expect(allowed).not.toContain("x-ope-platform-key");
      expect(allowed).not.toContain("x-ope-timestamp");
      expect(allowed).not.toContain("x-ope-signature");
      expect(allowed).toContain("x-ope-ingest-key");
    }
  });

  it("the SDK configuration and the diagnostics answer the preflight of a registered origin like the ingestion (feature 017)", async () => {
    for (const url of ["/v1/sdk/config", "/v1/sdk/diagnostics"]) {
      const res = await preflight(app, "https://a.example", "content-type, x-ope-ingest-key", url);
      expect(res.statusCode, url).toBe(204);
      expect(res.headers["access-control-allow-origin"], url).toBe("https://a.example");
      expect(String(res.headers["access-control-allow-headers"]).toLowerCase()).toContain("x-ope-ingest-key");
    }
    const foreign = await preflight(
      app,
      "https://nadie.example",
      "content-type, x-ope-ingest-key",
      "/v1/sdk/config",
    );
    expect(foreign.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("preflight from an origin no merchant registered → no Allow-Origin", async () => {
    const res = await preflight(app, "https://nadie.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("the preflight does not land on the contract wildcard route (no 405)", async () => {
    const res = await preflight(app, "https://b.example");
    expect(res.statusCode).not.toBe(405);
    expect(res.statusCode).toBe(204);
  });

  it("[invariant:origin-not-allowed] key of one merchant with the Origin of another → 403", async () => {
    const res = await postEvents(app.app, batchOf(1), { key: "key-a-1", origin: "https://b.example" });
    expect(res.statusCode).toBe(403);
    expect(problemOf(res)).toMatchObject({
      type: "urn:ope:problem:origin-not-allowed",
      status: 403,
      instance: "/v1/events",
    });
  });

  it("key and Origin of the same merchant → passes security and carries Allow-Origin in the response", async () => {
    const res = await postEvents(app.app, batchOf(1), { key: "key-a-1", origin: "https://a.example" });
    expect([401, 403]).not.toContain(res.statusCode);
    expect(res.headers["access-control-allow-origin"]).toBe("https://a.example");
  });

  it("without Origin (server to server, tests) it is processed normally", async () => {
    const res = await postEvents(app.app, batchOf(1), { key: "key-a-1" });
    expect([401, 403]).not.toContain(res.statusCode);
  });

  it("enables neither browser credentials (cookies) nor wildcard origins", async () => {
    const res = await preflight(app, "https://a.example");
    expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
    expect(res.headers["access-control-allow-origin"]).not.toBe("*");
  });
});
