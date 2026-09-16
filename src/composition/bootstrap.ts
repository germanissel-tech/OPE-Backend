// Composition root (constitución I; ADR-013): acá y sólo acá se carga el contrato, se eligen
// los adaptadores (perfil + overrides), se instancian los casos de uso y se cablean los
// controllers. main.ts sólo llama a esto.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "yaml";
import { buildServer, type ContractDocument } from "../infrastructure/http/build-server.js";
import { makeGetHealth } from "../interface-adapters/http/controllers/system/get-health.js";
import { isClosable, type Ports } from "./ports.js";
import { memoryPorts } from "./profiles/memory.js";
import { buildUseCases } from "./use-cases.js";
import type { AppConfig } from "./config.js";
import type { Handlers } from "../interface-adapters/http/typed.js";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";

export interface BootstrapOverrides {
  /** Reemplazos puntuales de puertos sobre el perfil (por ejemplo, un reloj fijo en pruebas). */
  ports?: Partial<Ports>;
  /** Manejadores que reemplazan a los cableados (pruebas negativas de contrato). */
  handlers?: Handlers;
  /** `false` en pruebas; `true` o un logger de Fastify en producción. */
  logger?: boolean | FastifyBaseLogger;
}

export interface App {
  app: FastifyInstance;
  ports: Ports;
  /** Apaga el servidor y después cada gateway que exponga `close()`, en orden inverso. */
  close: () => Promise<void>;
}

export async function bootstrap(config: AppConfig, overrides: BootstrapOverrides = {}): Promise<App> {
  const definition = loadContract(config.contractPath);
  const ports: Ports = { ...memoryPorts(), ...overrides.ports };
  const useCases = buildUseCases(ports, definition.info.version);

  const wired: Handlers =
    config.mode === "mock" ? {} : { getHealth: makeGetHealth(useCases.getServiceHealth) };
  const handlers: Handlers = { ...wired, ...(await loadHandlersModule(config)), ...overrides.handlers };

  const app = await buildServer({
    definition,
    handlers,
    mode: config.mode,
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
    throw new Error(`No existe el contrato empaquetado ${file}. Corré npm run contract:bundle.`);
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
