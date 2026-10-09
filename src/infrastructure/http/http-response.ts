// What every piece of the HTTP boundary shares: the response shape the handlers and the
// special handlers produce, how a Problem Details becomes one, how Fastify sends it, and the
// openapi-backend context read with `unknown` where the library declares `any`.
import { PROBLEM_CONTENT_TYPE, type ProblemResponse } from "../../interface-adapters/http/problem-details.js";
import type { FastifyReply } from "fastify";
import type { Context } from "openapi-backend";

export interface HttpResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
  contentType?: string;
}

/** Media type of every successful response of the contract (errors are PROBLEM_CONTENT_TYPE). */
export const JSON_CONTENT_TYPE = "application/json";

/** openapi-backend context with `unknown` where the library declares `any`. */
export type BoundaryContext = Context<
  unknown,
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, unknown>
>;

export function toHttp(res: ProblemResponse): HttpResponse {
  return { status: res.status, body: res.body, contentType: PROBLEM_CONTENT_TYPE };
}

export function send(reply: FastifyReply, res: HttpResponse): FastifyReply {
  if (res.headers) reply.headers(res.headers);
  const contentType = res.contentType ?? JSON_CONTENT_TYPE;
  return reply
    .status(res.status)
    .type(contentType)
    .send(withRequestId(reply, res, contentType));
}

/**
 * A Problem Details names its request (ADR-044): `requestId` is the identifier the transport minted,
 * the same as the `X-Request-Id` header. Added here, where every error passes, so that no controller
 * has to know the request to say which one failed.
 */
function withRequestId(reply: FastifyReply, res: HttpResponse, contentType: string): unknown {
  // A null body spreads to nothing, so it needs no guard of its own: the mutant that drops one survives.
  if (contentType !== PROBLEM_CONTENT_TYPE || typeof res.body !== "object") return res.body;
  return { ...res.body, requestId: reply.request.id };
}

/** The path of a request URL, without its query string: the `instance` of its problems. */
export function pathOf(url: string): string {
  const q = url.indexOf("?");
  return q === -1 ? url : url.slice(0, q);
}
