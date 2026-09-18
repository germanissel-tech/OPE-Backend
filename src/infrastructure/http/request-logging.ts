// Request logs without data that cannot be persisted (01-arquitectura-mvp.md §10.2; FR-016).
// Fastify logs `remoteAddress`, `remotePort` and `host` by default: here the serializer is
// replaced by one that only keeps method, url and `reqId` (which Fastify adds on its own). The
// ingest key is also redacted as a second barrier; the body is never logged.
import { INGEST_KEY_HEADER } from "../../interface-adapters/http/security/ingest-key.js";
import type { FastifyBaseLogger } from "fastify";

const requestSerializers = {
  req(request: { method: string; url: string }): { method: string; url: string } {
    return { method: request.method, url: request.url };
  },
  res(reply: { statusCode: number }): { statusCode: number } {
    return { statusCode: reply.statusCode };
  },
};

const REDACTED_PATHS = [`req.headers['${INGEST_KEY_HEADER}']`, `headers['${INGEST_KEY_HEADER}']`];

/** Any pino logger gets the same serializers and redaction (its own `req`/`res` are overridden). */
export function privateLogger(base: FastifyBaseLogger): FastifyBaseLogger {
  return base.child(
    {},
    { serializers: requestSerializers, redact: { paths: REDACTED_PATHS, censor: "[redacted]" } },
  );
}
