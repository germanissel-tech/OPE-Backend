// Manejadores alternativos para la prueba negativa de test:contract (US5 escenario 2):
// getHealth responde 203, un código que el contrato no declara. Schemathesis debe detectarlo.
// Uso: OPE_HANDLERS_MODULE=tests/contract/fixtures/health-203.ts npm run test:contract
import type { Handlers } from "../../../src/server/handlers.js";

export const handlers = {
  getHealth: async () => ({
    status: 203,
    body: { status: "ok", contractVersion: "1.0.0", timestamp: new Date().toISOString() },
  }),
} as unknown as Handlers;
