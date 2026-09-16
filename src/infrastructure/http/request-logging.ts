// Request logs without data that cannot be persisted (01-arquitectura-mvp.md §10.2; FR-016).
// Fastify logs `remoteAddress`, `remotePort` and `host` by default: here the serializer is
// replaced by one that only keeps method, url and `reqId` (which Fastify adds on its own). The
// ingest key is also redacted as a second barrier; the body is never logged.
import type { FastifyBaseLogger, FastifyServerOptions } from "fastify";

export const requestSerializers = {
  req(request: { method: string; url: string }): { method: string; url: string } {
    return { method: request.method, url: request.url };
  },
  res(reply: { statusCode: number }): { statusCode: number } {
    return { statusCode: reply.statusCode };
  },
};

export const REDACTED_PATHS = ["req.headers['x-ope-ingest-key']", "headers['x-ope-ingest-key']"];

/** Fastify logger options for `logger: true`. */
export const loggerOptions: Exclude<FastifyServerOptions["logger"], boolean | undefined> = {
  serializers: requestSerializers,
  redact: { paths: REDACTED_PATHS, censor: "[redacted]" },
};

/** A logger provided from outside gets the same serializers (its own `req`/`res` are overridden). */
export function privateLogger(base: FastifyBaseLogger): FastifyBaseLogger {
  return base.child({}, { serializers: requestSerializers, redact: { paths: REDACTED_PATHS } });
}
