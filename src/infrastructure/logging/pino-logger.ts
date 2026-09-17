// The `Logger` port on pino, with the privacy serializers of the request log (no IP, no
// headers, no body; the ingest key redacted). The same instance drives Fastify's own request
// logging, so the process has one log stream and one configuration.
import pino from "pino";
import { privateLogger } from "../http/request-logging.js";
import type { LogFields, Logger } from "../../application/shared-kernel/index.js";
import type { FastifyBaseLogger } from "fastify";

/** The pino instance behind a `Logger` built here; Fastify reuses it. Foreign loggers have none. */
const instances = new WeakMap<Logger, FastifyBaseLogger>();

export function pinoLogger(instance: pino.Logger = pino()): Logger {
  const base = privateLogger(instance);
  const logger: Logger = {
    info: (fields: LogFields, message: string) => {
      base.info(fields, message);
    },
    warn: (fields: LogFields, message: string) => {
      base.warn(fields, message);
    },
    error: (fields: LogFields, message: string) => {
      base.error(fields, message);
    },
  };
  instances.set(logger, base);
  return logger;
}

/** Nothing is written: tests, unless one captures the stream. */
export function silentLogger(): Logger {
  return pinoLogger(pino({ level: "silent" }));
}

/** The Fastify logger sharing the stream of a `Logger` built by `pinoLogger`, or none for a foreign one. */
export function fastifyLoggerOf(logger: Logger): FastifyBaseLogger | undefined {
  return instances.get(logger);
}
