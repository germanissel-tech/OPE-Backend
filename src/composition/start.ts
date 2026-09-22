// Starts a bootstrapped app as a process: attaches the lifecycle (signals, uncaught errors) and
// listens on the configured port. main.ts and the process-level test entries call this.
import { bootstrap, type BootstrapOverrides } from "./bootstrap.js";
import { attachLifecycle } from "./lifecycle.js";
import { LoggerPort } from "./modules/shared-kernel.js";
import type { AppConfig } from "./config.js";

export async function start(config: AppConfig, overrides: BootstrapOverrides = {}): Promise<void> {
  const { app, resolve, close } = await bootstrap(config, overrides);
  const logger = resolve(LoggerPort);
  attachLifecycle(process, { logger, close });
  await app.listen({ port: config.port, host: config.host });
  logger.info({ contract: config.contractPath, merchants: config.merchants.length }, "OPE backend ready");
}
