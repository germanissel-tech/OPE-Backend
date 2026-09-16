// CORS por merchant (FR-040; ADR-014). El preflight no trae la credencial: se acepta cualquier
// origen que algún merchant haya registrado. El request real verifica el par credencial + origen
// en el security handler (403 origin-not-allowed si no coincide).
import fastifyCors from "@fastify/cors";
import type { FastifyInstance } from "fastify";

export interface CorsPolicy {
  isRegisteredOrigin(origin: string): boolean;
}

export const CORS_ALLOWED_HEADERS = ["content-type", "x-ope-ingest-key"];

export async function registerCors(app: FastifyInstance, policy: CorsPolicy): Promise<void> {
  await app.register(fastifyCors, {
    origin: (origin, cb) => {
      // Sin Origin (servidor a servidor, curl, pruebas): no hay CORS que negociar.
      cb(null, origin === undefined || policy.isRegisteredOrigin(origin));
    },
    methods: ["POST"],
    allowedHeaders: CORS_ALLOWED_HEADERS,
    credentials: false,
    maxAge: 600,
    // El preflight lo responde este plugin; la ruta comodín del contrato no rutea OPTIONS.
    preflight: true,
    strictPreflight: true,
  });
}
