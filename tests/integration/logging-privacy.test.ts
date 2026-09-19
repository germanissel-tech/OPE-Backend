// US2 (FR-016; 01-arquitectura-mvp.md §10.2): the IP is neither persisted nor logged; neither
// are the ingest key and the request body. The logger stream is captured and inspected.
import { Writable } from "node:stream";
import pino from "pino";
import { afterEach, describe, expect, it } from "vitest";
import { pinoLogger } from "../../src/infrastructure/logging/pino-logger.js";
import { batchOf, fixedClock, postEvents, startTestApp } from "../helpers/test-app.js";
import type { App } from "../../src/composition/bootstrap.js";

let app: App | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

function capturedLogger(): { logger: pino.Logger; lines: () => string[] } {
  const chunks: string[] = [];
  const sink = new Writable({
    write(chunk: Buffer | string, _enc, cb) {
      chunks.push(chunk.toString());
      cb();
    },
  });
  return { logger: pino({ level: "info" }, sink), lines: () => chunks.join("").split("\n").filter(Boolean) };
}

describe("privacy in logs", () => {
  it("an ingest request leaves no IP, key, headers or body in the log; it does leave method, url, reqId and merchantId", async () => {
    const { logger, lines } = capturedLogger();
    app = await startTestApp({ ports: { clock: fixedClock(), logger: pinoLogger(logger) } });
    const batch = batchOf(2, 1, { page: { pageType: "product", productId: "SKU-SECRETO" } });
    const res = await postEvents(app.app, batch, { key: "key-a-1", remoteAddress: "203.0.113.9" });
    expect(res.statusCode).toBe(202);

    const log = lines().join("\n");
    expect(log).not.toContain("203.0.113.9");
    expect(log).not.toContain("remoteAddress");
    expect(log).not.toContain("key-a-1");
    expect(log).not.toContain("SKU-SECRETO");
    expect(log).not.toContain("vis_00000001");
    expect(log).not.toMatch(/"headers"/);

    const entries = lines().map((l) => JSON.parse(l) as Record<string, unknown>);
    const incoming = entries.find((e) => e["msg"] === "incoming request");
    expect(incoming).toBeDefined();
    expect(incoming?.["req"]).toMatchObject({ method: "POST", url: "/v1/events" });
    expect(incoming?.["reqId"]).toBeDefined();
    const withMerchant = entries.find((e) => e["merchantId"] === "m_a");
    expect(withMerchant, "the resolved merchant is logged for operations").toBeDefined();
  });

  it("a request rejected by the credential does not log the key or the IP either", async () => {
    const { logger, lines } = capturedLogger();
    app = await startTestApp({ ports: { clock: fixedClock(), logger: pinoLogger(logger) } });
    await postEvents(app.app, batchOf(1), { key: "clave-robada", remoteAddress: "198.51.100.7" });
    const log = lines().join("\n");
    expect(log).not.toContain("clave-robada");
    expect(log).not.toContain("198.51.100.7");
  });
});

describe("operational fields in logs", () => {
  const parsed = (lines: () => string[]): Record<string, unknown>[] =>
    lines().map((l) => JSON.parse(l) as Record<string, unknown>);

  it("a handler that throws is logged with its operationId and the error", async () => {
    const { logger, lines } = capturedLogger();
    app = await startTestApp({
      ports: { logger: pinoLogger(logger) },
      handlers: {
        getHealth: async () => {
          throw new Error("boom");
        },
      },
    });
    const res = await app.app.inject({ method: "GET", url: "/v1/health" });
    expect(res.statusCode).toBe(500);
    const entry = parsed(lines).find((e) => e["msg"] === "the handler threw an exception");
    expect(entry).toMatchObject({ operationId: "getHealth" });
    expect(entry?.["err"]).toBeDefined();
  });

  it("a response outside the contract is logged with operationId, status and what was declared", async () => {
    const { logger, lines } = capturedLogger();
    app = await startTestApp({
      ports: { logger: pinoLogger(logger) },
      handlers: { getHealth: async () => ({ status: 200, body: { status: "ok" } }) } as never,
    });
    await app.app.inject({ method: "GET", url: "/v1/health" });
    const entry = parsed(lines).find(
      (e) => e["msg"] === "the handler response does not satisfy the contract",
    );
    expect(entry).toMatchObject({ operationId: "getHealth", status: 200 });
    expect(entry?.["errors"]).toBeDefined();
  });

  it("an undeclared status is logged with the declared ones", async () => {
    const { logger, lines } = capturedLogger();
    app = await startTestApp({
      ports: { logger: pinoLogger(logger) },
      handlers: {
        getHealth: async () => ({
          status: 203,
          body: { status: "ok", contractVersion: "1.0.0", timestamp: "2026-09-16T12:00:00Z" },
        }),
      } as never,
    });
    await app.app.inject({ method: "GET", url: "/v1/health" });
    const entry = parsed(lines).find(
      (e) => e["msg"] === "the handler responded with a status not declared in the contract",
    );
    expect(entry).toMatchObject({ operationId: "getHealth", status: 203 });
    expect(entry?.["declared"]).toEqual(["200", "400", "500"]);
  });
});
