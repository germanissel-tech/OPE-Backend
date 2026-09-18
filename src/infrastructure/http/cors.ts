// CORS per merchant (FR-040; ADR-014). The preflight carries no credential: any origin some
// merchant registered is accepted. The real request verifies the pair credential + origin in the
// security handler (403 origin-not-allowed if they do not match).
import fastifyCors from "@fastify/cors";
import type { FastifyInstance } from "fastify";

export interface CorsPolicy {
  isRegisteredOrigin(origin: string): Promise<boolean>;
}

const CORS_ALLOWED_HEADERS = ["content-type", "x-ope-ingest-key"];

export async function registerCors(app: FastifyInstance, policy: CorsPolicy): Promise<void> {
  await app.register(fastifyCors, {
    origin: (origin, cb) => {
      // Without Origin (server to server, curl, tests): there is no CORS to negotiate.
      if (origin === undefined) {
        cb(null, true);
        return;
      }
      policy.isRegisteredOrigin(origin).then(
        (allowed) => {
          cb(null, allowed);
        },
        (err: unknown) => {
          cb(err instanceof Error ? err : new Error(String(err)), false);
        },
      );
    },
    methods: ["POST"],
    allowedHeaders: CORS_ALLOWED_HEADERS,
    credentials: false,
    maxAge: 600,
    // The preflight is answered by this plugin; the contract's wildcard route does not route OPTIONS.
    preflight: true,
    strictPreflight: true,
  });
}
