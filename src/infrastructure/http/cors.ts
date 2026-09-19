// CORS per merchant (FR-040; ADR-014). The preflight carries no credential: any origin some
// merchant registered is accepted. The real request verifies the pair credential + origin in the
// security handler (403 origin-not-allowed if they do not match).
import fastifyCors from "@fastify/cors";
import type { FastifyInstance } from "fastify";

export interface CorsPolicy {
  isRegisteredOrigin(origin: string): Promise<boolean>;
}

const CONTENT_TYPE_HEADER = "content-type";
/** Seconds a browser may cache a preflight answer: ten minutes, the ceiling Chromium honours. */
const PREFLIGHT_MAX_AGE_SECONDS = 600;

/**
 * CORS for the browser consumer. The credential headers a preflight may announce come from the
 * security schemes the modules wired (ADR-025): this file knows none of them by name.
 */
export async function registerCors(
  app: FastifyInstance,
  policy: CorsPolicy,
  credentialHeaders: readonly string[],
): Promise<void> {
  await app.register(fastifyCors, {
    // Async form (@fastify/cors resolves the promise; a rejection is "not allowed"). Without
    // Origin (server to server, curl, tests) there is no CORS to negotiate.
    // Stryker disable next-line all: for a request without Origin, allowed or not is indistinguishable; the mutants are equivalent
    origin: async (origin: string | undefined) => origin === undefined || policy.isRegisteredOrigin(origin),
    methods: ["POST"],
    allowedHeaders: [CONTENT_TYPE_HEADER, ...credentialHeaders],
    credentials: false,
    maxAge: PREFLIGHT_MAX_AGE_SECONDS,
    // The preflight is answered by this plugin; the contract's wildcard route does not route OPTIONS.
    preflight: true,
    strictPreflight: true,
  });
}
