// Servidor HTTP gobernado por el contrato (FR-040..FR-046).
// - openapi-backend carga el contrato (rechaza uno inválido), rutea por operationId, valida el
//   request antes del manejador y la respuesta después.
// - Fastify es sólo el transporte: una ruta comodín delega todo en openapi-backend, y sus
//   errores propios (JSON inválido, ruta desconocida) también salen como Problem Details.
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
import { registerCors, type CorsPolicy } from "./cors.js";
import type { operations } from "../../interface-adapters/http/generated/api.js";
import type { ErrorObject } from "ajv";

export type ContractDocument = Document;
export type ServerMode = "real" | "mock";

export interface BuildServerOptions<Ops extends OperationsMap<Ops> = operations> {
  definition: ContractDocument;
  /** NoInfer: el mapa de operaciones se fija explícitamente (por defecto, el generado). */
  handlers: Handlers<NoInfer<Ops>>;
  mode: ServerMode;
  /** Security handlers por nombre de esquema del contrato (`securitySchemes`). */
  security?: Record<string, SecurityHandler>;
  /** Política de orígenes para CORS; sin ella, el servidor no negocia CORS. */
  cors?: CorsPolicy;
  /** `false` en pruebas; `true` o un logger de Fastify en producción. */
  logger?: boolean | FastifyBaseLogger;
}

interface HttpResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
  contentType?: string;
}

const HTTP_METHODS = ["GET", "PUT", "POST", "DELETE", "PATCH", "OPTIONS", "HEAD", "TRACE"] as const;
/** Métodos que rutea la ruta comodín: OPTIONS queda para el preflight CORS (research R-04). */
const ROUTED_METHODS = HTTP_METHODS.filter((m) => m !== "OPTIONS");

/** Contexto de openapi-backend con `unknown` donde la librería declara `any`. */
type BoundaryContext = Context<
  unknown,
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, unknown>,
  Record<string, unknown>
>;

/** Forma del request que reciben los manejadores antes de que el tipo de la operación la refine. */
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

/** Traduce los errores de Ajv a `errors[]` de Problem Details, con punteros relativos al request. */
function toValidationErrors(errors: ErrorObject[] | null | undefined): ValidationError[] {
  return (errors ?? []).map((e) => {
    // Ajv apunta al objeto contenedor en additionalProperties/required; se afina al campo.
    // `params` es Record<string, any> en Ajv: se lee como unknown y se estrecha.
    const params: Record<string, unknown> = e.params;
    const detail = params["additionalProperty"] ?? params["missingProperty"];
    const suffix = typeof detail === "string" ? `/${detail}` : "";
    const pointer = `${e.instancePath}${suffix}`.replace(/^\/requestBody/, "/body") || "/";
    return { pointer, message: e.message ?? "violación del contrato" };
  });
}

function toHttp(res: ProblemResponse): HttpResponse {
  return { status: res.status, body: res.body, contentType: PROBLEM_CONTENT_TYPE };
}

/** Resultados de los security handlers sin la bandera `authorized` (que no es un principal). */
function securityResultsOf(c: BoundaryContext): Record<string, unknown> {
  const results: Record<string, unknown> = { ...(c.security as Record<string, unknown> | undefined) };
  delete results["authorized"];
  return results;
}

function pathOf(url: string): string {
  const q = url.indexOf("?");
  return q === -1 ? url : url.slice(0, q);
}

export async function buildServer<Ops extends OperationsMap<Ops> = operations>(
  options: BuildServerOptions<Ops>,
): Promise<FastifyInstance> {
  const { definition, handlers, mode } = options;
  const app = Fastify({ logger: options.logger ?? true });
  const log = app.log;
  if (options.cors) await registerCors(app, options.cors);

  const api = new OpenAPIBackend({
    definition,
    strict: true,
    validate: true,
    ajvOpts: { strict: false, allErrors: true },
    // Formatos de OpenAPI (date-time, uri, ...) para validar request y response.
    // ajv-formats es CommonJS: bajo ESM el callable está en `.default`.
    customizeAjv: (ajv) => ajvFormats.default(ajv),
  });

  /** Métodos declarados en el contrato para un path (vacío si el path no existe). */
  const allowedMethods = (requestPath: string): string[] =>
    HTTP_METHODS.filter(
      (method) => api.matchOperation({ method, path: requestPath, headers: {} }) !== undefined,
    );

  /** 405 con `Allow` si el path existe en el contrato con otros métodos; 404 si no existe. */
  const unroutable = (requestPath: string): HttpResponse => {
    const allowed = allowedMethods(requestPath);
    if (allowed.length === 0) {
      return toHttp(
        problem("not-found", {
          instance: requestPath,
          detail: `No hay ninguna operación para ${requestPath}.`,
        }),
      );
    }
    const res = toHttp(
      problem("method-not-allowed", {
        instance: requestPath,
        detail: `Métodos declarados: ${allowed.join(", ")}.`,
      }),
    );
    return { ...res, headers: { allow: allowed.join(", ") } };
  };

  // Security handlers: corren antes de la validación y del manejador; su error decide el status.
  for (const [scheme, handler] of Object.entries(options.security ?? {})) {
    api.registerSecurityHandler(scheme, (c: BoundaryContext) =>
      handler({ headers: c.request.headers as Record<string, string | string[] | undefined> }),
    );
  }
  const securityFailure = (c: BoundaryContext): HttpResponse => {
    const results = c.security as Record<string, unknown> | undefined;
    for (const [name, result] of Object.entries(results ?? {})) {
      if (name === "authorized" || typeof result !== "object" || result === null) continue;
      const error: unknown = (result as { error?: unknown }).error;
      if (error instanceof SecurityError) return toHttp(problem(error.slug, { instance: c.request.path }));
    }
    return toHttp(problem("unauthorized", { instance: c.request.path }));
  };

  // Manejadores especiales de openapi-backend → Problem Details.
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
          detail: `No hay ninguna operación para ${c.request.method.toUpperCase()} ${c.request.path}.`,
        }),
      ),
    methodNotAllowed: async (c: Context): Promise<HttpResponse> => unroutable(c.request.path),
    notImplemented: async (c: Context): Promise<HttpResponse> => {
      const operationId = c.operation.operationId ?? "(sin operationId)";
      if (mode === "mock") {
        try {
          const mocked = api.mockResponseForOperation(operationId);
          // El ejemplo del contrato llega como any; el servidor no asume nada sobre su forma.
          const body: unknown = mocked.mock;
          return { status: mocked.status, body, contentType: "application/json" };
        } catch (err) {
          log.warn({ operationId, err }, "mock: la operación no declara ejemplo");
          return toHttp(
            problem("not-implemented", {
              instance: c.request.path,
              detail: `La operación ${operationId} no declara ejemplo para el mock.`,
            }),
          );
        }
      }
      return toHttp(
        problem("not-implemented", {
          instance: c.request.path,
          detail: `La operación ${operationId} está declarada en el contrato pero no tiene manejador registrado.`,
        }),
      );
    },
  });

  // Manejadores de dominio, envueltos: request tipado → manejador → validación de la respuesta.
  for (const [operationId, handler] of Object.entries(handlers) as [
    string,
    ((req: unknown) => Promise<HttpResponse>) | undefined,
  ][]) {
    if (!handler) continue;
    // openapi-backend lanza si el operationId no existe en el contrato (SC-005).
    api.register(operationId, async (c: BoundaryContext): Promise<HttpResponse> => {
      // Único borde con openapi-backend: sus tipos son any; acá se leen como unknown y el
      // manejador recibe el TypedRequest que su firma exige (validado ya contra el contrato).
      const request: TypedRequestBoundary = {
        operationId,
        instance: c.request.path,
        path: c.request.params,
        query: c.request.query,
        headers: c.request.headers,
        cookie: c.request.cookies,
        body: c.request.requestBody,
        security: securityResultsOf(c),
      };
      let result: HttpResponse;
      try {
        result = await handler(request);
      } catch (err) {
        log.error({ operationId, err }, "el manejador lanzó una excepción");
        return toHttp(problem("internal-error", { instance: c.request.path }));
      }
      const declared = Object.keys(c.operation.responses ?? {});
      if (!declared.includes(String(result.status))) {
        log.error(
          { operationId, status: result.status, declared },
          "el manejador respondió un código no declarado en el contrato",
        );
        return toHttp(problem("response-contract-violation", { instance: c.request.path }));
      }
      const validation = api.validateResponse(result.body, operationId, result.status);
      if (!validation.valid) {
        log.error(
          { operationId, status: result.status, errors: validation.errors },
          "la respuesta del manejador no cumple el contrato",
        );
        return toHttp(problem("response-contract-violation", { instance: c.request.path }));
      }
      return { ...result, contentType: result.contentType ?? "application/json" };
    });
  }

  // Falla el arranque si el contrato es inválido (FR-040).
  await api.init();

  const send = (reply: FastifyReply, res: HttpResponse): FastifyReply => {
    if (res.headers) reply.headers(res.headers);
    return reply
      .status(res.status)
      .type(res.contentType ?? "application/json")
      .send(res.body);
  };

  const dispatch = async (request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> => {
    const res = (await api.handleRequest({
      method: request.method,
      path: pathOf(request.url),
      query: request.query as Record<string, string | string[]>,
      body: request.body,
      headers: request.headers as Record<string, string | string[]>,
    })) as HttpResponse;
    return send(reply, res);
  };

  app.route({ method: [...ROUTED_METHODS], url: "/", handler: dispatch });
  app.route({ method: [...ROUTED_METHODS], url: "/*", handler: dispatch });

  // Métodos que Fastify no rutea (por ejemplo QUERY) caen acá: 405 si el path existe, 404 si no.
  app.setNotFoundHandler(async (request, reply) => send(reply, unroutable(pathOf(request.url))));

  app.setErrorHandler(async (error: Error & { code?: string; statusCode?: number }, request, reply) => {
    const instance = pathOf(request.url);
    // Método no ruteado con body sin content-type: Fastify lo rechaza antes de rutear.
    if (error.code === "FST_ERR_ROUTE_MISSING_CONTENT_TYPE") return send(reply, unroutable(instance));
    // Errores del parser de Fastify: JSON inválido, body vacío, media type no soportado.
    if (typeof error.code === "string" && error.code.startsWith("FST_ERR_CTP_")) {
      return send(
        reply,
        toHttp(
          problem("validation-failed", { instance, errors: [{ pointer: "/body", message: error.message }] }),
        ),
      );
    }
    log.error({ err: error }, "error no controlado");
    return send(reply, toHttp(problem("internal-error", { instance })));
  });

  return app;
}
