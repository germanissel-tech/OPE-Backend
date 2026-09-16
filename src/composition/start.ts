// Starts a bootstrapped app as a process: listens on the configured port and shuts down on
// SIGINT/SIGTERM. main.ts and the process-level test entries call this; nothing else does.
import { bootstrap, type BootstrapOverrides } from "./bootstrap.js";
import type { AppConfig } from "./config.js";

export async function start(config: AppConfig, overrides: BootstrapOverrides = {}): Promise<void> {
  const { app, close } = await bootstrap(config, overrides);
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
