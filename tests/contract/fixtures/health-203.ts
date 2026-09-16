// Process entry for the negative test of test:contract (US5 scenario 2): the whole app, but
// getHealth responds 203, a status the contract does not declare. Schemathesis must detect it.
// Usage: OPE_SERVER_ENTRY=tests/contract/fixtures/health-203.ts npm run test:contract
import { readFileSync } from "node:fs";
import { readConfig } from "../../../src/composition/config.js";
import { start } from "../../../src/composition/start.js";
import type { Handlers } from "../../../src/interface-adapters/http/typed.js";

const handlers = {
  getHealth: async () => ({
    status: 203,
    body: { status: "ok", contractVersion: "1.0.0", timestamp: new Date().toISOString() },
  }),
} as unknown as Handlers;

start(
  readConfig(process.env, (file) => readFileSync(file, "utf8")),
  { handlers },
).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
