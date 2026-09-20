// The bytes of a request: kept aside as received for the platform signature (ADR-029), and
// bounded by the consumer of the operation before any of them is read (ADR-025; audit 014 F-057).
import { problem } from "../../interface-adapters/http/problem-details.js";
import { JSON_CONTENT_TYPE, pathOf, send, toHttp } from "./http-response.js";
import type { SecurityScheme } from "../../interface-adapters/http/typed.js";
import type { ProtoAction, FastifyInstance, FastifyRequest } from "fastify";
import type { OpenAPIBackend } from "openapi-backend";

/**
 * Body limits by consumer: a full catalogue snapshot travels in one request from the platform,
 * so its credential admits 32 MiB; a browser with the public ingest credential sends at most a
 * batch of 50 events, so its operations admit 1 MiB. The server-wide `bodyLimit` is the
 * platform's: a body without `Content-Length` (chunked) falls back to it.
 */
const BYTES_PER_KIB = 1024;
const BYTES_PER_MIB = BYTES_PER_KIB * BYTES_PER_KIB;
const SERVER_BODY_LIMIT_MIB = 32;
const BROWSER_BODY_LIMIT_MIB = 1;
export const BODY_LIMIT_BYTES = SERVER_BODY_LIMIT_MIB * BYTES_PER_MIB;
const BROWSER_BODY_LIMIT_BYTES = BROWSER_BODY_LIMIT_MIB * BYTES_PER_MIB;

/** The body limit of the operation a request targets: the platform's when a server credential guards it. */
function bodyLimitOf(
  api: OpenAPIBackend,
  security: Readonly<Record<string, SecurityScheme>>,
  request: FastifyRequest,
): number {
  const operation = api.matchOperation({ method: request.method, path: pathOf(request.url), headers: {} });
  const schemes = operation?.security?.flatMap((requirement) => Object.keys(requirement));
  // The consumer of the first scheme (every built operation declares exactly one); a public
  // operation, an unknown path or a scheme nobody wired keep the browser's limit.
  const consumer = security[schemes?.[0] ?? ""]?.consumer;
  return consumer === "server" ? BODY_LIMIT_BYTES : BROWSER_BODY_LIMIT_BYTES;
}

/** Refuses, before a byte of the body is read, a request whose declared length exceeds its consumer's limit. */
export function refuseOversizedBodies(
  app: FastifyInstance,
  api: OpenAPIBackend,
  security: Readonly<Record<string, SecurityScheme>>,
): void {
  app.addHook("onRequest", async (request, reply) => {
    const declared = Number(request.headers["content-length"]);
    if (!Number.isFinite(declared) || declared <= bodyLimitOf(api, security, request)) return;
    return send(reply, toHttp(problem("payload-too-large", { instance: pathOf(request.url) })));
  });
}

/** The body bytes of each request, exactly as received: what a platform signature covers (ADR-029). */
const rawBodies = new WeakMap<FastifyRequest, Uint8Array>();

/** The bytes of a request's body as received, if it had one. */
export const rawBodyOf = (request: FastifyRequest): Uint8Array | undefined => rawBodies.get(request);

/** Callback form of Fastify's default JSON parser: `(request, text, done)`. */
type JsonParser = (
  request: FastifyRequest,
  text: string,
  done: (err: Error | null, body?: unknown) => void,
) => void;

/**
 * JSON keeps parsing exactly as Fastify does (same `FST_ERR_CTP_*` errors), but the bytes are
 * kept aside for the security handlers before anything reads the parsed body.
 */
export function keepRawBodies(app: FastifyInstance): void {
  // Prototype and constructor poisoning are rejected, as Fastify does by default.
  const poisoning: ProtoAction = "error";
  const parseJson = app.getDefaultJsonParser(poisoning, poisoning) as JsonParser;
  app.addContentTypeParser(JSON_CONTENT_TYPE, { parseAs: "buffer" }, (request, body: Buffer, done) => {
    rawBodies.set(request, new Uint8Array(body));
    parseJson(request, body.toString("utf8"), done);
  });
}
