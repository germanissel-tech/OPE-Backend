// Starts a bootstrapped app as a process: attaches the lifecycle (signals, uncaught errors) and
// listens on the configured port. main.ts and the process-level test entries call this.
import { bootstrap, type BootstrapOverrides } from "./bootstrap.js";
import { attachLifecycle } from "./lifecycle.js";
import type { AppConfig } from "./config.js";

export async function start(config: AppConfig, overrides: BootstrapOverrides = {}): Promise<void> {
  const { app, ports, close } = await bootstrap(config, overrides);
  attachLifecycle(process, { logger: ports.logger, close });
  await app.listen({ port: config.port, host: config.host });
  ports.logger.info(
    { contract: config.contractPath, merchants: config.merchants.length },
    "OPE backend ready",
  );
}
