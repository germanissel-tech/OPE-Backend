// HTTP server governed by the contract (FR-040..FR-046): the assembly.
// - openapi-backend loads the contract (rejects an invalid one), routes by operationId, validates
//   the request before the handler and the response after it.
// - Fastify is transport only: a wildcard route delegates everything to openapi-backend, and its
//   own errors (invalid JSON, unknown route) also come out as Problem Details.
// The pieces live next door: `raw-bodies.ts` (the bytes and their limits), `security-boundary.ts`
// (the wired security handlers) and `dispatch.ts` (handlers, special handlers, routes).
import ajvFormats from "ajv-formats";
import Fastify, { type FastifyInstance } from "fastify";
import { OpenAPIBackend, type Document } from "openapi-backend";
import { fastifyLoggerOf } from "../logging/pino-logger.js";
import { registerCors, type CorsPolicy } from "./cors.js";
import { badUrl, mountRoutes, registerHandlers, registerSpecialHandlers, type Runtime } from "./dispatch.js";
import { send } from "./http-response.js";
import { BODY_LIMIT_BYTES, keepRawBodies, refuseOversizedBodies } from "./raw-bodies.js";
import { registerSecurity } from "./security-boundary.js";
import { stripDiscriminatorMappings } from "./strip-discriminator-mappings.js";
import type { operations } from "#generated/api.js";
import type { Logger } from "../../application/shared-kernel/index.js";
import type { Handlers, OperationsMap, SecurityScheme } from "../../interface-adapters/http/typed.js";

export type ContractDocument = Document;

export interface BuildServerOptions<Ops extends OperationsMap<Ops> = operations> {
  definition: ContractDocument;
  /** NoInfer: the operations map is set explicitly (by default, the generated one). */
  handlers: Handlers<NoInfer<Ops>>;
  /** Security schemes by contract scheme name (`securitySchemes`): the handler and the credential header. */
  security?: Record<string, SecurityScheme>;
  /** Origin policy for CORS; without it, the server does not negotiate CORS. */
  cors?: CorsPolicy | undefined;
  /** The process logger; Fastify's request log shares its stream when it is pino-backed. */
  logger: Logger;
  /** Seconds every `503` tells the client to wait (`Retry-After`; level 1 of the configuration, ADR-021). */
  retryAfterSeconds: number;
}

const SERVICE_UNAVAILABLE = 503;
const RETRY_AFTER = "retry-after";

/** Every 503 carries `Retry-After` (ADR-021): a write a store could not accept is retried, not lost. */
function retryAfterOn503(app: FastifyInstance, seconds: number): void {
  app.addHook("onSend", (_request, reply, payload, done) => {
    if (reply.statusCode === SERVICE_UNAVAILABLE && !reply.hasHeader(RETRY_AFTER)) {
      reply.header(RETRY_AFTER, String(seconds));
    }
    done(null, payload);
  });
}

/**
 * The Fastify instance: transport only, with CORS when a policy is given. Request logging runs
 * on the stream of the process logger; a foreign `Logger` (a test stub) gets no request log.
 */
async function createApp(
  options: Pick<BuildServerOptions, "logger" | "cors" | "security" | "retryAfterSeconds">,
): Promise<FastifyInstance> {
  const loggerInstance = fastifyLoggerOf(options.logger);
  const app = Fastify({
    bodyLimit: BODY_LIMIT_BYTES,
    // A URL that cannot be decoded (`FST_ERR_BAD_URL`) is answered as Problem Details, like every error.
    frameworkErrors: (error, request, reply) => {
      send(reply, badUrl(error, request.url));
    },
    // Stryker disable next-line ConditionalExpression: to Fastify an undefined loggerInstance is no logger; the mutant is equivalent
    ...(loggerInstance ? { loggerInstance } : {}),
  });
  keepRawBodies(app);
  retryAfterOn503(app, options.retryAfterSeconds);
  // Only the credentials a browser sends are announced to a preflight (ADR-025 §5: platformKey without CORS).
  const credentialHeaders = Object.values(options.security ?? {})
    .filter((scheme) => scheme.consumer === "browser")
    .map((scheme) => scheme.header);
  if (options.cors) await registerCors(app, options.cors, credentialHeaders);
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

export async function buildServer<Ops extends OperationsMap<Ops> = operations>(
  options: BuildServerOptions<Ops>,
): Promise<FastifyInstance> {
  const app = await createApp(options);
  const api = createApi(options.definition);
  const runtime: Runtime = { api, log: app.log };
  registerSecurity(api, options.security ?? {});
  refuseOversizedBodies(app, api, options.security ?? {});
  registerSpecialHandlers(runtime);
  registerHandlers(runtime, options.handlers);
  // Startup fails if the contract is invalid (FR-040).
  await api.init();
  mountRoutes(app, api);
  return app;
}
