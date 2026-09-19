// US5 (FR-010, FR-017; ADR-014): the ingest credential identifies the merchant before anything else.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { problemOf } from "../helpers/json.js";
import { batchOf, postEvents, sharedTestApp, type SharedApp } from "../helpers/test-app.js";

// One server per file (015 F-055): the in-memory ports are rebuilt before each test.
let app: SharedApp;
beforeAll(async () => {
  app = await sharedTestApp();
});
beforeEach(() => {
  app.resetPorts();
});
afterAll(async () => {
  await app.close();
});

describe("ingest credential (X-OPE-Ingest-Key)", () => {
  it("no header → 401 unauthorized as Problem Details, before body validation", async () => {
    const res = await postEvents(app.app, { garbage: true });
    expect(res.statusCode).toBe(401);
    expect(res.headers["content-type"]).toMatch("application/problem+json");
    expect(problemOf(res)).toMatchObject({
      type: "urn:ope:problem:unauthorized",
      status: 401,
      instance: "/v1/events",
    });
  });

  it("unknown key → 401; the response does not say whether the key exists for another merchant", async () => {
    const res = await postEvents(app.app, batchOf(1), { key: "key-nadie" });
    expect(res.statusCode).toBe(401);
    expect(problemOf(res).type).toBe("urn:ope:problem:unauthorized");
    expect(res.body).not.toContain("key-nadie");
  });

  it("valid key with invalid body → 400: security first, validation after", async () => {
    const res = await postEvents(app.app, { garbage: true }, { key: "key-a-1" });
    expect(res.statusCode).toBe(400);
    expect(problemOf(res).type).toBe("urn:ope:problem:validation-failed");
  });

  it("either of the two active keys of the merchant passes security (rotation)", async () => {
    for (const key of ["key-a-1", "key-a-2"]) {
      const res = await postEvents(app.app, batchOf(1), { key });
      expect(res.statusCode, key).not.toBe(401);
      expect(res.statusCode, key).not.toBe(403);
    }
  });

  it("neither the key nor the merchantId appears in any response", async () => {
    const res = await postEvents(app.app, batchOf(1), { key: "key-a-1" });
    expect(res.body).not.toContain("key-a-1");
    expect(res.body).not.toContain("m_a");
  });
});
