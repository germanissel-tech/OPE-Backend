// The security boundary over openapi-backend: the wired security handlers run before
// validation and before any handler; what they leave in the context becomes the principals
// the handlers read and the safe fields of the request log, and the failure of the one that
// refused decides the status (ADR-020, ADR-025).
import { problem } from "../../interface-adapters/http/problem-details.js";
import { SecurityError, type SecurityScheme } from "../../interface-adapters/http/typed.js";
import { toHttp, type BoundaryContext, type HttpResponse } from "./http-response.js";
import { rawBodyOf } from "./raw-bodies.js";
import type { FastifyRequest } from "fastify";
import type { OpenAPIBackend } from "openapi-backend";

/**
 * What each security handler left in `context.security`, by scheme name. openapi-backend leaves
 * `security` undefined when the operation is public and adds its own boolean `authorized`.
 */
function securityOutcomes(c: BoundaryContext): [string, Record<string, unknown>][] {
  const results = (c.security as Record<string, unknown> | undefined) ?? {};
  return Object.entries(results).filter(
    // Stryker disable next-line ConditionalExpression,LogicalOperator: openapi-backend only stores handler objects and the boolean `authorized` here; the guard is defensive and its mutants are equivalent
    (entry): entry is [string, Record<string, unknown>] => typeof entry[1] === "object" && entry[1] !== null,
  );
}

/** Principals by scheme (without the `authorized` flag) and the safe fields for the request log. */
export function securityResultsOf(c: BoundaryContext): {
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

/** The Problem Details of the security handler that failed; `unauthorized` if none said which. */
export function securityFailure(c: BoundaryContext): HttpResponse {
  for (const [, result] of securityOutcomes(c)) {
    const error: unknown = result["error"];
    if (error instanceof SecurityError) return toHttp(problem(error.slug, { instance: c.request.path }));
  }
  return toHttp(problem("unauthorized", { instance: c.request.path }));
}

/** The capabilities an operation declares (`x-required-capabilities`, ADR-020); none when absent. */
function requiredCapabilities(c: BoundaryContext): string[] {
  const declared: unknown = (c.operation as Record<string, unknown>)["x-required-capabilities"];
  // Stryker disable next-line all: the contract lint guarantees an array of strings; the narrowing has no other input
  return Array.isArray(declared) ? declared.filter((v): v is string => typeof v === "string") : [];
}

/**
 * Security handlers run before validation and the handler; their error decides the status.
 * Whatever the handler grants, the operation's required capabilities must be among them
 * (ADR-025): a valid credential of the wrong consumer is 403, before the body is read.
 */
export function registerSecurity(api: OpenAPIBackend, security: Record<string, SecurityScheme>): void {
  for (const [scheme, { handler }] of Object.entries(security)) {
    api.registerSecurityHandler(scheme, async (c: BoundaryContext, req: FastifyRequest) => {
      const outcome = await handler({
        headers: c.request.headers as Record<string, string | string[] | undefined>,
        rawBody: rawBodyOf(req),
      });
      const missing = requiredCapabilities(c).filter((cap) => !outcome.capabilities.includes(cap));
      if (missing.length > 0) throw new SecurityError("capability-missing");
      return outcome;
    });
  }
}
