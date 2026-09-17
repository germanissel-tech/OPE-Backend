// Entry point: reads the configuration and starts through the composition root.
// No concrete instance lives here (ADR-013). Anything that stops the start, configuration
// included, comes out as one line and exit code 1.
import { readFileSync } from "node:fs";
import { readConfig } from "./composition/config.js";
import { start } from "./composition/start.js";

async function main(): Promise<void> {
  await start(readConfig(process.env, (file) => readFileSync(file, "utf8")));
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Could not start the server: ${message}`);
  process.exit(1);
});
