// Eval fixture: a composition root that chooses the profile with a branch on configuration and
// infers the shutdown order from the ports object (the pre-005 bootstrap, condensed).
interface Closable {
  close(): Promise<void> | void;
}
interface Ports {
  clock: { now(): Date };
  decisions: Closable & { record(d: unknown): void };
}
interface Config {
  persistence: "memory" | "postgres";
}

declare function memoryPorts(clock?: Ports["clock"]): Ports;
declare function postgresPorts(clock?: Ports["clock"]): Ports;

export async function bootstrap(config: Config, overrides: Partial<Ports> = {}): Promise<{ close: () => Promise<void> }> {
  const clock = overrides.clock;
  const ports: Ports =
    config.persistence === "postgres" ? { ...postgresPorts(clock), ...overrides } : { ...memoryPorts(clock), ...overrides };
  const close = async (): Promise<void> => {
    for (const port of Object.values(ports).reverse()) {
      if (typeof port === "object" && "close" in port) await (port as Closable).close();
    }
  };
  return Promise.resolve({ close });
}
