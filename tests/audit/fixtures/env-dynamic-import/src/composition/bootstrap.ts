// Eval fixture: handlers loaded from a module whose path comes from the environment (the old
// `loadHandlersModule`): a test seam, and an injection point, in production code.
import path from "node:path";
import { pathToFileURL } from "node:url";

interface Config {
  handlersModule: string | undefined;
}

export async function loadHandlersModule(config: Config): Promise<Record<string, unknown>> {
  if (config.handlersModule === undefined) return {};
  const mod = (await import(pathToFileURL(path.resolve(config.handlersModule)).href)) as {
    handlers: Record<string, unknown>;
  };
  return mod.handlers;
}
