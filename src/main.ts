// Entry point: reads the configuration and starts through the composition root.
// No concrete instance lives here (ADR-013). Anything that stops the start, configuration
// included, comes out as one line and exit code 1.
//
// The process runs the **durable** deployment (feature 030): a restart here is a deploy or a
// crash, and losing the ledger to one was what this feature came to end. The local deployment,
// with everything in memory, is what the test suite builds and nothing else.
import { readFileSync } from "node:fs";
import { readConfig } from "./composition/config.js";
import { durableDeployment } from "./composition/deployments/durable.js";
import { start } from "./composition/start.js";

async function main(): Promise<void> {
  await start(
    readConfig(process.env, (file) => readFileSync(file, "utf8")),
    {
      deployment: durableDeployment,
    },
  );
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Could not start the server: ${message}`);
  process.exit(1);
});
