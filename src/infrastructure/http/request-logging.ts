// Logs de request sin datos que no se pueden persistir (01-arquitectura-mvp.md §10.2; FR-016).
// Fastify loguea por defecto `remoteAddress`, `remotePort` y `host`: acá se reemplaza el
// serializer por uno que sólo deja método, url y `reqId` (que Fastify agrega solo). La clave de
// ingesta se redacta además como segunda barrera; el cuerpo nunca se loguea.
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

/** Opciones de logger de Fastify para `logger: true`. */
export const loggerOptions: Exclude<FastifyServerOptions["logger"], boolean | undefined> = {
  serializers: requestSerializers,
  redact: { paths: REDACTED_PATHS, censor: "[redactado]" },
};

/** Un logger provisto desde afuera recibe los mismos serializers (sus propios `req`/`res` se pisan). */
export function privateLogger(base: FastifyBaseLogger): FastifyBaseLogger {
  return base.child({}, { serializers: requestSerializers, redact: { paths: REDACTED_PATHS } });
}
