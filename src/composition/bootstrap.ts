// Composition root (constitution I; ADR-013): here and only here the contract is loaded, the
// adapters are chosen (profile + overrides), the use cases are instantiated and the controllers
// are wired. main.ts only calls this.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "yaml";
import { buildServer, type ContractDocument } from "../infrastructure/http/build-server.js";
import { makeIngestEvents } from "../interface-adapters/http/controllers/ingestion/ingest-events.js";
import { makeConfirmExposureHandler } from "../interface-adapters/http/controllers/ledger/confirm-exposure.js";
import { makeGetHealth } from "../interface-adapters/http/controllers/system/get-health.js";
import { INGEST_KEY_SCHEME, makeIngestKeySecurity } from "../interface-adapters/http/security/ingest-key.js";
import { isClosable, type Ports } from "./ports.js";
import { memoryPorts } from "./profiles/memory.js";
import { buildUseCases } from "./use-cases.js";
import type { AppConfig } from "./config.js";
import type { Handlers } from "../interface-adapters/http/typed.js";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";

export interface BootstrapOverrides {
  /** Targeted port replacements over the profile (for example, a fixed clock in tests). */
  ports?: Partial<Ports>;
  /** Handlers that replace the wired ones (negative contract tests). */
  handlers?: Handlers;
  /** `false` in tests; `true` or a Fastify logger in production. */
  logger?: boolean | FastifyBaseLogger;
}

export interface App {
  app: FastifyInstance;
  ports: Ports;
  /** Shuts down the server and then every gateway exposing `close()`, in reverse order. */
  close: () => Promise<void>;
}

export async function bootstrap(config: AppConfig, overrides: BootstrapOverrides = {}): Promise<App> {
  const definition = loadContract(config.contractPath);
  // The clock is resolved first: the profile gateways that depend on it (dedup) share it.
  const clock = overrides.ports?.clock;
  const ports: Ports = { ...memoryPorts(config, clock), ...overrides.ports };
  const useCases = buildUseCases(ports, definition.info.version);

  const wired: Handlers =
    config.mode === "mock"
      ? {}
      : {
          getHealth: makeGetHealth(useCases.getServiceHealth),
          ingestEvents: makeIngestEvents(useCases.ingestBatch),
          confirmExposure: makeConfirmExposureHandler(useCases.confirmExposure),
        };
  const handlers: Handlers = { ...wired, ...(await loadHandlersModule(config)), ...overrides.handlers };

  // Security also runs in mock: the SDK develops against the mock with the real key (SC-006).
  const app = await buildServer({
    definition,
    handlers,
    mode: config.mode,
    security: { [INGEST_KEY_SCHEME]: makeIngestKeySecurity(useCases.resolveIngestKey) },
    cors: ports.merchants,
    logger: overrides.logger ?? true,
  });

  const close = async (): Promise<void> => {
    await app.close();
    for (const port of Object.values(ports).reverse()) {
      if (isClosable(port)) await port.close();
    }
  };
  return { app, ports, close };
}

function loadContract(file: string): ContractDocument {
  if (!existsSync(file)) {
    throw new Error(`Bundled contract ${file} does not exist. Run npm run contract:bundle.`);
  }
  return parse(readFileSync(file, "utf8")) as ContractDocument;
}

async function loadHandlersModule(config: AppConfig): Promise<Handlers> {
  if (config.handlersModule === undefined) return {};
  const mod = (await import(pathToFileURL(path.resolve(config.handlersModule)).href)) as {
    handlers: Handlers;
  };
  return mod.handlers;
}
