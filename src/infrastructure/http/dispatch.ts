// Dispatch over the contract (FR-040..FR-046): the domain handlers wrapped in the typed
// request and the response validation, openapi-backend's special handlers as Problem Details,
// and the wildcard route where Fastify hands every request over — its own errors (invalid JSON,
// unknown route, a body past the limit) come out as Problem Details too.
import {
  PROBLEM_CONTENT_TYPE,
  problem,
  type ValidationError,
} from "../../interface-adapters/http/problem-details.js";
import {
  JSON_CONTENT_TYPE,
  pathOf,
  send,
  toHttp,
  type BoundaryContext,
  type HttpResponse,
} from "./http-response.js";
import { securityFailure, securityResultsOf } from "./security-boundary.js";
import type { ErrorObject } from "ajv";
import type { FastifyBaseLogger, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Context, OpenAPIBackend } from "openapi-backend";

const HTTP_METHODS = ["GET", "PUT", "POST", "DELETE", "PATCH", "OPTIONS", "HEAD", "TRACE"] as const;
/** What an operation declared without a handler answers (FR-044); the composition root refuses to start with one. */
const NOT_IMPLEMENTED_DETAIL = (operationId: string): string =>
  `Operation ${operationId} is declared in the contract but has no registered handler.`;
/** JSON pointer of the request body in Problem Details `errors`; openapi-backend validates it as `/requestBody`. */
const BODY_POINTER = "/body";
const REQUEST_BODY_PREFIX = "/requestBody";
/** First error status: from here on every response of the contract is Problem Details. */
const FIRST_ERROR_STATUS = 400;
/** Methods routed by the wildcard route: OPTIONS is left to the CORS preflight (research R-04). */
const ROUTED_METHODS = HTTP_METHODS.filter((m) => m !== "OPTIONS");

/** What every registration step needs: the API and the server log. */
export interface Runtime {
  api: OpenAPIBackend;
  log: FastifyBaseLogger;
}

/** Shape of the request handlers receive before the operation type refines it. */
interface TypedRequestBoundary {
  operationId: string;
  instance: string;
  path: unknown;
  query: unknown;
  headers: unknown;
  cookie: unknown;
  body: unknown;
  security: Record<string, unknown>;
}

/** Translates Ajv errors to Problem Details `errors[]`, with pointers relative to the request. */
function toValidationErrors(errors: ErrorObject[] | null | undefined): ValidationError[] {
  return (errors ?? []).map((e) => {
    // Ajv points at the containing object for additionalProperties/required; narrow to the field.
    // `params` is Record<string, any> in Ajv: read as unknown and narrowed.
    const params: Record<string, unknown> = e.params;
    const detail = params["additionalProperty"] ?? params["missingProperty"];
    const suffix = typeof detail === "string" ? `/${detail}` : "";
    const raw = `${e.instancePath}${suffix}`;
    const pointer = raw.startsWith(REQUEST_BODY_PREFIX)
      ? `${BODY_POINTER}${raw.slice(REQUEST_BODY_PREFIX.length)}`
      : raw;
    return { pointer: pointer || "/", message: e.message ?? "contract violation" };
  });
}

/** 405 with `Allow` if the path exists in the contract with other methods; 404 if it does not. */
function unroutable(api: OpenAPIBackend, requestPath: string): HttpResponse {
  const allowed = HTTP_METHODS.filter(
    (method) => api.matchOperation({ method, path: requestPath, headers: {} }) !== undefined,
  );
  if (allowed.length === 0) {
    return toHttp(
      problem("not-found", { instance: requestPath, detail: `There is no operation for ${requestPath}.` }),
    );
  }
  const res = toHttp(
    problem("method-not-allowed", {
      instance: requestPath,
      detail: `Declared methods: ${allowed.join(", ")}.`,
    }),
  );
  return { ...res, headers: { allow: allowed.join(", ") } };
}

/** An operation declared in the contract without a handler: 501, never an empty 200 (FR-044). */
function notImplemented(c: Context): HttpResponse {
  const operationId = c.operation.operationId ?? "(no operationId)";
  return toHttp(
    problem("not-implemented", { instance: c.request.path, detail: NOT_IMPLEMENTED_DETAIL(operationId) }),
  );
}

/** openapi-backend special handlers → Problem Details. */
export function registerSpecialHandlers(runtime: Runtime): void {
  const { api } = runtime;
  api.register({
    unauthorizedHandler: async (c: Context): Promise<HttpResponse> => securityFailure(c as BoundaryContext),
    validationFail: async (c: Context): Promise<HttpResponse> =>
      toHttp(
        problem("validation-failed", {
          instance: c.request.path,
          errors: toValidationErrors(c.validation.errors),
        }),
      ),
    notFound: async (c: Context): Promise<HttpResponse> =>
      toHttp(
        problem("not-found", {
          instance: c.request.path,
          detail: `There is no operation for ${c.request.method.toUpperCase()} ${c.request.path}.`,
        }),
      ),
    methodNotAllowed: async (c: Context): Promise<HttpResponse> => unroutable(api, c.request.path),
    notImplemented: async (c: Context): Promise<HttpResponse> => notImplemented(c),
  });
}

/** The handler result is only sent if its status and body are what the contract declares (FR-045). */
function validateResult(
  { api, log }: Runtime,
  c: BoundaryContext,
  operationId: string,
  result: HttpResponse,
): HttpResponse {
  const declared = Object.keys(c.operation.responses ?? {});
  if (!declared.includes(String(result.status))) {
    log.error(
      { operationId, status: result.status, declared },
      "the handler responded with a status not declared in the contract",
    );
    return toHttp(problem("response-contract-violation", { instance: c.request.path }));
  }
  const validation = api.validateResponse(result.body, operationId, result.status);
  if (!validation.valid) {
    log.error(
      { operationId, status: result.status, errors: validation.errors },
      "the handler response does not satisfy the contract",
    );
    return toHttp(problem("response-contract-violation", { instance: c.request.path }));
  }
  // Every 4xx/5xx of the contract is Problem Details (ruleset rule): the media type follows from the status.
  const contentType = result.status >= FIRST_ERROR_STATUS ? PROBLEM_CONTENT_TYPE : JSON_CONTENT_TYPE;
  return { ...result, contentType: result.contentType ?? contentType };
}

type BoundaryHandler = (req: unknown) => Promise<HttpResponse>;

/** Domain handlers, wrapped: typed request → handler → response validation. */
export function registerHandlers(runtime: Runtime, handlers: Record<string, unknown>): void {
  const { api, log } = runtime;
  for (const [operationId, handler] of Object.entries(handlers) as [string, BoundaryHandler | undefined][]) {
    if (!handler) continue;
    // openapi-backend throws if the operationId does not exist in the contract (SC-005).
    api.register(
      operationId,
      async (c: BoundaryContext, req: FastifyRequest, reply: FastifyReply): Promise<HttpResponse> => {
        // Single boundary with openapi-backend: its types are any; here they are read as unknown and
        // the handler receives the TypedRequest its signature demands (already validated against the contract).
        const { principals, logFields } = securityResultsOf(c);
        // The safe fields of the principal (merchantId) accompany the rest of the request log.
        req.log = req.log.child(logFields);
        reply.log = req.log;
        const request: TypedRequestBoundary = {
          operationId,
          instance: c.request.path,
          path: c.request.params,
          query: c.request.query,
          headers: c.request.headers,
          cookie: c.request.cookies,
          body: c.request.requestBody,
          security: principals,
        };
        try {
          return validateResult(runtime, c, operationId, await handler(request));
        } catch (err) {
          log.error({ operationId, err }, "the handler threw an exception");
          return toHttp(problem("internal-error", { instance: c.request.path }));
        }
      },
    );
  }
}

/** Wildcard routes delegate to openapi-backend; Fastify's own errors also come out as Problem Details. */
export function mountRoutes(app: FastifyInstance, api: OpenAPIBackend): void {
  const dispatch = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
    const res = (await api.handleRequest(
      {
        method: request.method,
        path: pathOf(request.url),
        query: request.query as Record<string, string | string[]>,
        body: request.body,
        headers: request.headers as Record<string, string | string[]>,
      },
      request,
      reply,
    )) as HttpResponse;
    return send(reply, res);
  };
  // The wildcard also matches the root path: every declared method of every path lands here.
  app.route({ method: [...ROUTED_METHODS], url: "/*", handler: dispatch });

  // Methods Fastify does not route (for example QUERY) land here: 405 if the path exists, 404 if not.
  app.setNotFoundHandler(async (request, reply) => send(reply, unroutable(api, pathOf(request.url))));

  app.setErrorHandler(async (error: Error & { code?: string; statusCode?: number }, request, reply) => {
    const instance = pathOf(request.url);
    // Unrouted method with a body and no content-type: Fastify rejects it before routing.
    if (error.code === "FST_ERR_ROUTE_MISSING_CONTENT_TYPE") return send(reply, unroutable(api, instance));
    // A chunked body past the server-wide limit: Fastify stops reading it; the same answer as the declared case.
    if (error.code === "FST_ERR_CTP_BODY_TOO_LARGE") {
      return send(reply, toHttp(problem("payload-too-large", { instance })));
    }
    // Fastify parser errors: invalid JSON, empty body, unsupported media type.
    if (typeof error.code === "string" && error.code.startsWith("FST_ERR_CTP_")) {
      return send(
        reply,
        toHttp(
          problem("validation-failed", {
            instance,
            errors: [{ pointer: BODY_POINTER, message: error.message }],
          }),
        ),
      );
    }
    // Stryker disable next-line all: defensive catch-all; no request reaches it through the contract
    app.log.error({ err: error }, "unhandled error");
    return send(reply, toHttp(problem("internal-error", { instance })));
  });
}
