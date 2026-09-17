// Shape fixture: the composition root decides the mode by branching on configuration.
interface Config {
  mode: "real" | "mock";
  port: number;
}
declare function wired(): Record<string, unknown>;

export function bootstrap(config: Config): { handlers: Record<string, unknown>; port: number } {
  const handlers = config.mode === "mock" ? {} : wired();
  if (config.mode === "real" && Object.keys(handlers).length === 0) throw new Error("nothing wired");
  // Reading a field to pass it on is not a decision.
  return { handlers, port: config.port };
}
