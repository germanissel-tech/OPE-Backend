// Composition root (constitution I; ADR-013): here and only here a profile builds the ports and
// the modules wire themselves to the contract. Which profile and which modules run are
// parameters (the local deployment and every module of the system by default; a test or a tool may pass
// others), never a branch on configuration; what has to be closed, and in which order, is what
// the profile reports it created; which operations exist is what the modules serve, checked
// against the contract before listening.
import { Operator } from "../domain/operator/index.js";
import { buildServer } from "../infrastructure/http/build-server.js";
import { loadContract } from "../infrastructure/http/load-contract.js";
import { ConfigError, type AppConfig } from "./config.js";
import { assertEveryOperationWired } from "./coverage.js";
import { importConfigurationOf } from "./modules/configuration.js";
import { MODULES } from "./modules/index.js";
import { importMerchantsOf } from "./modules/merchant.js";
import { localProfile } from "./profiles/local.js";
import { wireModules, type Module } from "./wiring.js";
import type { Closable, Ports } from "./ports.js";
import type { Profile } from "./profile.js";
import type { Handlers } from "../interface-adapters/http/typed.js";
import type { FastifyInstance } from "fastify";

export interface BootstrapOverrides {
  /** The profile that builds the ports; the local one unless a caller (main, a test) says otherwise. */
  profile?: Profile;
  /** The modules that serve the contract; all of them unless a caller (a test, a tool) says otherwise. */
  modules?: readonly Module<Ports>[];
  /** Targeted port replacements the profile applies (for example, a fixed clock in tests). */
  ports?: Partial<Ports>;
  /** Handlers that replace the wired ones (negative contract tests). */
  handlers?: Handlers;
}

export interface App {
  app: FastifyInstance;
  ports: Ports;
  /** Shuts down the server, then what the profile created, in reverse creation order. */
  close: () => Promise<void>;
}

async function shutdown(app: FastifyInstance, closables: readonly Closable[]): Promise<void> {
  await app.close();
  for (const closable of [...closables].reverse()) await closable.close();
}

/**
 * The seed of the configuration enters an empty store through the same use cases as the API
 * (ADR-031): the merchants, then what each declares of its configuration as its version 1; a
 * store that already holds them keeps them. A seed the configuration accepted and the entity
 * rejects is a programming error; a declared value the resolution refuses stops the start
 * naming the field (constitution XI).
 */
export async function importSeed(config: AppConfig, ports: Ports): Promise<void> {
  const actor = Operator.system();
  const seeds = config.merchants.map((m) => m.seed);
  const imported = await importMerchantsOf(ports).execute({ actor, seeds });
  if (!imported.ok) throw new Error(`The merchant seed was rejected: ${imported.error.code}.`);
  if ("imported" in imported.value && imported.value.imported > 0) {
    ports.logger.info({ merchants: imported.value.imported }, "merchant seed imported");
  }
  const importConfiguration = importConfigurationOf(ports);
  for (const [i, merchant] of config.merchants.entries()) {
    if (Object.keys(merchant.declared).length === 0) continue;
    const configured = await importConfiguration.execute({
      actor,
      merchantId: merchant.merchantId,
      declared: merchant.declared,
    });
    if (!configured.ok) {
      const { pointer, problem } = configured.error.details;
      throw new ConfigError(`merchants[${i}].${String(pointer)}`, `is invalid (${String(problem)})`);
    }
  }
}

export async function bootstrap(config: AppConfig, overrides: BootstrapOverrides = {}): Promise<App> {
  const definition = loadContract(config.contractPath);
  const { ports, closables } = (overrides.profile ?? localProfile)(config, overrides.ports ?? {});
  await importSeed(config, ports);
  const wired = wireModules(overrides.modules ?? MODULES, { ports, contract: definition });
  const handlers: Handlers = { ...wired.handlers, ...overrides.handlers };
  assertEveryOperationWired(definition, handlers);
  const app = await buildServer({
    definition,
    handlers,
    security: wired.security,
    cors: wired.cors,
    logger: ports.logger,
  });
  return { app, ports, close: () => shutdown(app, closables) };
}
