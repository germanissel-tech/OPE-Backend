// Composition root único (constitución I): acá y sólo acá se lee la configuración, se carga el
// contrato, se instancian las dependencias y se cablean los manejadores.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "yaml";
import { systemClock } from "./adapters/clock/system-clock.js";
import { buildServer, type ContractDocument, type ServerMode } from "./adapters/http/build-server.js";
import { makeGetHealth } from "./handlers/health.js";
import type { Handlers } from "./handlers/typed.js";

interface Config {
  port: number;
  host: string;
  mode: ServerMode;
  contractPath: string;
  /** Sólo para pruebas: módulo alternativo que exporta `handlers`. */
  handlersModule: string | undefined;
}

function readConfig(env: NodeJS.ProcessEnv): Config {
  return {
    port: Number(env["PORT"] ?? 3000),
    host: env["HOST"] ?? "127.0.0.1",
    mode: env["OPE_MOCK"] === "1" ? "mock" : "real",
    contractPath: path.resolve(env["OPE_CONTRACT"] ?? "contracts/dist/openapi.yaml"),
    handlersModule: env["OPE_HANDLERS_MODULE"],
  };
}

function loadContract(file: string): ContractDocument {
  if (!existsSync(file)) {
    throw new Error(`No existe el contrato empaquetado ${file}. Corré npm run contract:bundle.`);
  }
  return parse(readFileSync(file, "utf8")) as ContractDocument;
}

async function loadHandlers(config: Config, contractVersion: string): Promise<Handlers> {
  if (config.mode === "mock") return {};
  if (config.handlersModule) {
    const mod = (await import(pathToFileURL(path.resolve(config.handlersModule)).href)) as {
      handlers: Handlers;
    };
    return mod.handlers;
  }
  return {
    getHealth: makeGetHealth({ contractVersion, clock: systemClock }),
  };
}

async function main(): Promise<void> {
  const config = readConfig(process.env);
  const definition = loadContract(config.contractPath);
  const handlers = await loadHandlers(config, definition.info.version);
  const app = await buildServer({ definition, handlers, mode: config.mode, logger: true });

  const shutdown = (signal: string): void => {
    app.log.info({ signal }, "apagando");
    void app.close().then(() => process.exit(0));
  };
  process.once("SIGINT", () => {
    shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    shutdown("SIGTERM");
  });

  await app.listen({ port: config.port, host: config.host });
  app.log.info(
    { mode: config.mode, contract: config.contractPath, version: definition.info.version },
    "OPE backend listo",
  );
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`No se pudo arrancar el servidor: ${message}`);
  process.exit(1);
});
