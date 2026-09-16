// Alternative handlers for the negative test of test:contract (US5 scenario 2):
// getHealth responds 203, a status the contract does not declare. Schemathesis must detect it.
// Uso: OPE_HANDLERS_MODULE=tests/contract/fixtures/health-203.ts npm run test:contract
import type { Handlers } from "../../../src/interface-adapters/http/typed.js";

export const handlers = {
  getHealth: async () => ({
    status: 203,
    body: { status: "ok", contractVersion: "1.0.0", timestamp: new Date().toISOString() },
  }),
} as unknown as Handlers;
