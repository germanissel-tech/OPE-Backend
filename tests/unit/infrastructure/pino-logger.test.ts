// The Logger port on pino: fields and message reach the stream with the privacy redaction; the
// same instance drives Fastify; a foreign Logger (a stub) gives Fastify no request log.
import { Writable } from "node:stream";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { buildServer } from "../../../src/infrastructure/http/build-server.js";
import { loadContract } from "../../../src/infrastructure/http/load-contract.js";
import {
  fastifyLoggerOf,
  pinoLogger,
  silentLogger,
} from "../../../src/infrastructure/logging/pino-logger.js";
import type { Logger } from "../../../src/application/shared-kernel/index.js";

function captured(): { instance: pino.Logger; lines: () => string[] } {
  const chunks: string[] = [];
  const sink = new Writable({
    write(chunk: Buffer | string, _enc, cb) {
      chunks.push(chunk.toString());
      cb();
    },
  });
  return {
    instance: pino({ level: "info" }, sink),
    lines: () => chunks.join("").split("\n").filter(Boolean),
  };
}

describe("pinoLogger", () => {
  it("writes each level with its fields and message, redacting the ingest key", () => {
    const { instance, lines } = captured();
    const logger = pinoLogger(instance);
    logger.info({ a: 1 }, "one");
    logger.warn({ headers: { "x-ope-ingest-key": "secret" } }, "two");
    logger.error({ err: new Error("boom") }, "three");
    const out = lines().map((l) => JSON.parse(l) as Record<string, unknown>);
    expect(out.map((l) => [l["level"], l["msg"]])).toEqual([
      [30, "one"],
      [40, "two"],
      [50, "three"],
    ]);
    expect(out[0]).toMatchObject({ a: 1 });
    expect(JSON.stringify(out[1])).not.toContain("secret");
    expect(JSON.stringify(out[1])).toContain("[redacted]");
    expect(out[2]).toMatchObject({ err: { message: "boom" } });
  });

  it("exposes its pino instance to Fastify; a foreign logger has none", () => {
    expect(fastifyLoggerOf(pinoLogger(captured().instance))).toBeDefined();
    expect(fastifyLoggerOf(silentLogger())).toBeDefined();
    const stub: Logger = { info: () => undefined, warn: () => undefined, error: () => undefined };
    expect(fastifyLoggerOf(stub)).toBeUndefined();
  });

  it("silentLogger() is silent: its pino instance runs at level 'silent'", () => {
    // FastifyBaseLogger only types `level`; the pino instance behind it is what decides.
    const instance = fastifyLoggerOf(silentLogger()) as pino.Logger | undefined;
    expect(instance?.level).toBe("silent");
    for (const level of ["error", "warn", "info"] as const) {
      expect(instance?.isLevelEnabled(level), level).toBe(false);
    }
  });

  it("the server runs on a foreign logger without request logging", async () => {
    const calls: string[] = [];
    const stub: Logger = {
      info: (_f, m) => calls.push(m),
      warn: (_f, m) => calls.push(m),
      error: (_f, m) => calls.push(m),
    };
    const app = await buildServer({
      definition: loadContract("contracts/dist/openapi.yaml"),
      handlers: {},
      logger: stub,
    });
    try {
      expect((await app.inject({ method: "GET", url: "/v1/health" })).statusCode).toBe(501);
      expect(calls).toEqual([]);
    } finally {
      await app.close();
    }
  });
});
