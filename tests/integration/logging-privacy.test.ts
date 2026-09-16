// US2 (FR-016; 01-arquitectura-mvp.md §10.2): la IP no se persiste ni se loguea; la clave de
// ingesta y el cuerpo del request tampoco. Se captura el stream del logger y se inspecciona.
import { Writable } from "node:stream";
import pino from "pino";
import { afterEach, describe, expect, it } from "vitest";
import { batchOf, postEvents, startTestApp } from "../helpers/test-app.js";
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

describe("privacidad en logs", () => {
  it("un request de ingesta no deja IP, clave, headers ni cuerpo en el log; sí método, url, reqId y merchantId", async () => {
    const { logger, lines } = capturedLogger();
    app = await startTestApp({ logger });
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
    expect(withMerchant, "el merchant resuelto se loguea para operar").toBeDefined();
  });

  it("un request rechazado por la credencial tampoco loguea la clave ni la IP", async () => {
    const { logger, lines } = capturedLogger();
    app = await startTestApp({ logger });
    await postEvents(app.app, batchOf(1), { key: "clave-robada", remoteAddress: "198.51.100.7" });
    const log = lines().join("\n");
    expect(log).not.toContain("clave-robada");
    expect(log).not.toContain("198.51.100.7");
  });
});
