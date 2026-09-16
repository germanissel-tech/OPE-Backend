// Composition root (constitution I; ADR-013): here and only here a profile builds the ports and
// the modules wire themselves to the contract. Which profile runs is a parameter (in memory by
// default), never a branch on configuration; what has to be closed, and in which order, is what
// the profile reports it created; which operations exist is what the modules serve, checked
// against the contract before listening.
import { buildServer } from "../infrastructure/http/build-server.js";
import { loadContract } from "../infrastructure/http/load-contract.js";
import { assertEveryOperationWired } from "./coverage.js";
import { MODULES } from "./modules/index.js";
import { memoryProfile } from "./profiles/memory.js";
import { wireModules } from "./wiring.js";
import type { AppConfig } from "./config.js";
import type { Closable, Ports } from "./ports.js";
import type { Profile } from "./profile.js";
import type { Handlers } from "../interface-adapters/http/typed.js";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";

export interface BootstrapOverrides {
  /** The profile that builds the ports; in memory unless a caller (main, a test) says otherwise. */
  profile?: Profile;
  /** Targeted port replacements the profile applies (for example, a fixed clock in tests). */
  ports?: Partial<Ports>;
  /** Handlers that replace the wired ones (negative contract tests). */
  handlers?: Handlers;
  /** `false` in tests; `true` or a Fastify logger in production. */
  logger?: boolean | FastifyBaseLogger;
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

export async function bootstrap(config: AppConfig, overrides: BootstrapOverrides = {}): Promise<App> {
  const definition = loadContract(config.contractPath);
  const { ports, closables } = (overrides.profile ?? memoryProfile)(config, overrides.ports ?? {});
  const wired = wireModules(MODULES, { ports, contractVersion: definition.info.version });
  // In mock mode the contract examples answer; wired controllers would shadow them.
  const handlers: Handlers = { ...(config.mode === "mock" ? {} : wired.handlers), ...overrides.handlers };
  if (config.mode === "real") assertEveryOperationWired(definition, handlers);
  const app = await buildServer({
    definition,
    handlers,
    mode: config.mode,
    security: wired.security,
    ...(wired.cors ? { cors: wired.cors } : {}),
    logger: overrides.logger ?? true,
  });
  return { app, ports, close: () => shutdown(app, closables) };
}
