// Eval fixture: the composition root drops the wired handlers when the configuration says
// "mock" and hands the flag down to the server, which decides again.
import type { ServerMode } from "../infrastructure/http/build-server.js";

interface Config {
  mode: ServerMode;
}
type Handlers = Record<string, () => Promise<unknown>>;
declare function wireModules(): Handlers;
declare function buildServer(options: { handlers: Handlers; mode: ServerMode }): Promise<unknown>;

export function bootstrap(config: Config): Promise<unknown> {
  const handlers = config.mode === "mock" ? {} : wireModules();
  return buildServer({ handlers, mode: config.mode });
}
