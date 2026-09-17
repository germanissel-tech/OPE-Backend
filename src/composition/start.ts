// Starts a bootstrapped app as a process: listens on the configured port and shuts down on
// SIGINT/SIGTERM. main.ts and the process-level test entries call this; nothing else does.
import { bootstrap, type BootstrapOverrides } from "./bootstrap.js";
import type { AppConfig } from "./config.js";

/** What a terminal (Ctrl+C) and a container runtime (docker stop, Kubernetes) send to stop the process. */
const SHUTDOWN_SIGNALS = ["SIGINT", "SIGTERM"] as const satisfies readonly NodeJS.Signals[];

export async function start(config: AppConfig, overrides: BootstrapOverrides = {}): Promise<void> {
  const { app, close } = await bootstrap(config, overrides);
  const shutdown = (signal: NodeJS.Signals): void => {
    app.log.info({ signal }, "shutting down");
    void close().then(() => process.exit(0));
  };
  for (const signal of SHUTDOWN_SIGNALS) {
    process.once(signal, () => {
      shutdown(signal);
    });
  }
  await app.listen({ port: config.port, host: config.host });
  app.log.info({ contract: config.contractPath, merchants: config.merchants.length }, "OPE backend ready");
}
