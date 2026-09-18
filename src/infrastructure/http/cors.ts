// CORS per merchant (FR-040; ADR-014). The preflight carries no credential: any origin some
// merchant registered is accepted. The real request verifies the pair credential + origin in the
// security handler (403 origin-not-allowed if they do not match).
import fastifyCors from "@fastify/cors";
import { INGEST_KEY_HEADER } from "../../interface-adapters/http/security/ingest-key.js";
import type { FastifyInstance } from "fastify";

export interface CorsPolicy {
  isRegisteredOrigin(origin: string): Promise<boolean>;
}

// PROPUESTO (feature 014): when a second security scheme arrives, each scheme declares its
// credential header in the wiring and this list is derived from it instead of imported here.
const CORS_ALLOWED_HEADERS = ["content-type", INGEST_KEY_HEADER];

export async function registerCors(app: FastifyInstance, policy: CorsPolicy): Promise<void> {
  await app.register(fastifyCors, {
    // Async form (@fastify/cors resolves the promise; a rejection is "not allowed"). Without
    // Origin (server to server, curl, tests) there is no CORS to negotiate.
    // Stryker disable next-line all: for a request without Origin, allowed or not is indistinguishable; the mutants are equivalent
    origin: async (origin: string | undefined) => origin === undefined || policy.isRegisteredOrigin(origin),
    methods: ["POST"],
    allowedHeaders: CORS_ALLOWED_HEADERS,
    credentials: false,
    maxAge: 600,
    // The preflight is answered by this plugin; the contract's wildcard route does not route OPTIONS.
    preflight: true,
    strictPreflight: true,
  });
}
