// Entry point: reads the configuration, starts through the composition root and handles signals.
// No concrete instance lives here (ADR-013).
import { readFileSync } from "node:fs";
import { bootstrap } from "./composition/bootstrap.js";
import { readConfig } from "./composition/config.js";

async function main(): Promise<void> {
  const config = readConfig(process.env, (file) => readFileSync(file, "utf8"));
  const { app, close } = await bootstrap(config);

  const shutdown = (signal: string): void => {
    app.log.info({ signal }, "shutting down");
    void close().then(() => process.exit(0));
  };
  process.once("SIGINT", () => {
    shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    shutdown("SIGTERM");
  });

  await app.listen({ port: config.port, host: config.host });
  app.log.info(
    { mode: config.mode, contract: config.contractPath, merchants: config.merchants.length },
    "OPE backend ready",
  );
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Could not start the server: ${message}`);
  process.exit(1);
});
