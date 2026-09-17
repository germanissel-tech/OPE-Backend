// HTTP server governed by the contract (FR-040..FR-046).
// - openapi-backend loads the contract (rejects an invalid one), routes by operationId, validates
//   the request before the handler and the response after it.
// - Fastify is transport only: a wildcard route delegates everything to openapi-backend, and its
//   own errors (invalid JSON, unknown route) also come out as Problem Details.
import ajvFormats from "ajv-formats";
import Fastify, {
  type FastifyBaseLogger,
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import { OpenAPIBackend, type Context, type Document } from "openapi-backend";
import {
  PROBLEM_CONTENT_TYPE,
  problem,
  type ProblemResponse,
  type ValidationError,
} from "../../interface-adapters/http/problem-details.js";
import {
  SecurityError,
  type Handlers,
  type OperationsMap,
  type SecurityHandler,
} from "../../interface-adapters/http/typed.js";
import { fastifyLoggerOf } from "../logging/pino-logger.js";
import { registerCors, type CorsPolicy } from "./cors.js";
import { stripDiscriminatorMappings } from "./strip-discriminator-mappings.js";
import type { Logger } from "../../application/shared-kernel/index.js";
import type { operations } from "../../interface-adapters/http/generated/api.js";
import type { ErrorObject } from "ajv";

export type ContractDocument = Document;

export interface BuildServerOptions<Ops extends OperationsMap<Ops> = operations> {
  definition: ContractDocument;
  /** NoInfer: the operations map is set explicitly (by default, the generated one). */
  handlers: Handlers<NoInfer<Ops>>;
  /** Security handlers by contract scheme name (`securitySchemes`). */
  security?: Record<string, SecurityHandler>;
  /** Origin policy for CORS; without it, the server does not negotiate CORS. */
  cors?: CorsPolicy | undefined;
  /** The process logger; Fastify's request log shares its stream when it is pino-backed. */
  logger: Logger;
}

interface HttpResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
  contentType?: string;
}

const HTTP_METHODS = ["GET", "PUT", "POST", "DELETE", "PATCH", "OPTIONS", "HEAD", "TRACE"] as const;
/** Media type of every successful response of the contract (errors are PROBLEM_CONTENT_TYPE). */
const JSON_CONTENT_TYPE = "application/json";
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

/** openapi-backend context with `unknown` where the library declares `any`. */
type BoundaryContext = Context<
  unknown,
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, unknown>
>;

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

function toHttp(res: ProblemResponse): HttpResponse {
  return { status: res.status, body: res.body, contentType: PROBLEM_CONTENT_TYPE };
}

/** Principals by scheme (without the `authorized` flag) and safe fields for the request log. */
/**
 * What each security handler left in `context.security`, by scheme name. openapi-backend leaves
 * `security` undefined when the operation is public and adds its own boolean `authorized`.
 */
function securityOutcomes(c: BoundaryContext): [string, Record<string, unknown>][] {
  const results = (c.security as Record<string, unknown> | undefined) ?? {};
  // Stryker disable ConditionalExpression,LogicalOperator: openapi-backend only stores handler objects and the boolean `authorized` here; the guard is defensive and its mutants are equivalent
  return Object.entries(results).filter(
    (entry): entry is [string, Record<string, unknown>] => typeof entry[1] === "object" && entry[1] !== null,
  );
  // Stryker restore ConditionalExpression,LogicalOperator
}

function securityResultsOf(c: BoundaryContext): {
  principals: Record<string, unknown>;
  logFields: Record<string, unknown>;
} {
  const principals: Record<string, unknown> = {};
  const logFields: Record<string, unknown> = {};
  for (const [name, outcome] of securityOutcomes(c)) {
    const { principal, log } = outcome as { principal?: unknown; log?: Record<string, unknown> };
    principals[name] = principal;
    Object.assign(logFields, log);
  }
  return { principals, logFields };
}

function pathOf(url: string): string {
  const q = url.indexOf("?");
  return q === -1 ? url : url.slice(0, q);
}

/**
 * The Fastify instance: transport only, with CORS when a policy is given. Request logging runs
 * on the stream of the process logger; a foreign `Logger` (a test stub) gets no request log.
 */
async function createApp(options: Pick<BuildServerOptions, "logger" | "cors">): Promise<FastifyInstance> {
  const loggerInstance = fastifyLoggerOf(options.logger);
  // Stryker disable next-line ConditionalExpression: to Fastify an undefined loggerInstance is no logger; the mutant is equivalent
  const app = Fastify(loggerInstance ? { loggerInstance } : {});
  if (options.cors) await registerCors(app, options.cors);
  return app;
}

/** openapi-backend over the published contract, validating request and response. */
function createApi(definition: ContractDocument): OpenAPIBackend {
  return new OpenAPIBackend({
    // The contract comes in as published, except for `discriminator.mapping` (research R-05).
    definition: stripDiscriminatorMappings(definition),
    strict: true,
    validate: true,
    // `discriminator: true`: one precise error per branch of the event union, not one per branch.
    ajvOpts: { strict: false, allErrors: true, discriminator: true },
    // OpenAPI formats (date-time, uri, ...) to validate request and response.
    // ajv-formats is CommonJS: under ESM the callable is in `.default`.
    customizeAjv: (ajv) => ajvFormats.default(ajv),
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

/** The Problem Details of the security handler that failed; `unauthorized` if none said which. */
function securityFailure(c: BoundaryContext): HttpResponse {
  for (const [, result] of securityOutcomes(c)) {
    const error: unknown = result["error"];
    if (error instanceof SecurityError) return toHttp(problem(error.slug, { instance: c.request.path }));
  }
  return toHttp(problem("unauthorized", { instance: c.request.path }));
}

/** Security handlers run before validation and the handler; their error decides the status. */
function registerSecurity(api: OpenAPIBackend, security: Record<string, SecurityHandler>): void {
  for (const [scheme, handler] of Object.entries(security)) {
    api.registerSecurityHandler(scheme, (c: BoundaryContext) =>
      handler({ headers: c.request.headers as Record<string, string | string[] | undefined> }),
    );
  }
}

/** What every registration step needs: the API, the server log and the mode. */
interface Runtime {
  api: OpenAPIBackend;
  log: FastifyBaseLogger;
}

/** An operation declared in the contract without a handler: 501, never an empty 200 (FR-044). */
function notImplemented(c: Context): HttpResponse {
  const operationId = c.operation.operationId ?? "(no operationId)";
  return toHttp(
    problem("not-implemented", { instance: c.request.path, detail: NOT_IMPLEMENTED_DETAIL(operationId) }),
  );
}

/** openapi-backend special handlers → Problem Details. */
function registerSpecialHandlers(runtime: Runtime): void {
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
function registerHandlers(runtime: Runtime, handlers: Record<string, unknown>): void {
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
        if (Object.keys(logFields).length > 0) {
          // The safe fields of the principal (merchantId) accompany the rest of the request log.
          req.log = req.log.child(logFields);
          reply.log = req.log;
        }
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

function send(reply: FastifyReply, res: HttpResponse): FastifyReply {
  if (res.headers) reply.headers(res.headers);
  return reply
    .status(res.status)
    .type(res.contentType ?? JSON_CONTENT_TYPE)
    .send(res.body);
}

/** Wildcard routes delegate to openapi-backend; Fastify's own errors also come out as Problem Details. */
function mountRoutes(app: FastifyInstance, api: OpenAPIBackend): void {
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
  app.route({ method: [...ROUTED_METHODS], url: "/", handler: dispatch });
  app.route({ method: [...ROUTED_METHODS], url: "/*", handler: dispatch });

  // Methods Fastify does not route (for example QUERY) land here: 405 if the path exists, 404 if not.
  app.setNotFoundHandler(async (request, reply) => send(reply, unroutable(api, pathOf(request.url))));

  app.setErrorHandler(async (error: Error & { code?: string; statusCode?: number }, request, reply) => {
    const instance = pathOf(request.url);
    // Unrouted method with a body and no content-type: Fastify rejects it before routing.
    if (error.code === "FST_ERR_ROUTE_MISSING_CONTENT_TYPE") return send(reply, unroutable(api, instance));
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

export async function buildServer<Ops extends OperationsMap<Ops> = operations>(
  options: BuildServerOptions<Ops>,
): Promise<FastifyInstance> {
  const app = await createApp(options);
  const api = createApi(options.definition);
  const runtime: Runtime = { api, log: app.log };
  registerSecurity(api, options.security ?? {});
  registerSpecialHandlers(runtime);
  registerHandlers(runtime, options.handlers);
  // Startup fails if the contract is invalid (FR-040).
  await api.init();
  mountRoutes(app, api);
  return app;
}
