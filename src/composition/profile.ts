// A profile builds every port of `Ports` for one environment (in memory today; Postgres/Redis
// when they arrive) and owns two things the composition root must not guess: which overrides
// replace which gateway, and the order in which what it created has to be closed (ADR-013).
import { isClosable, type Closable, type Ports } from "./ports.js";
import type { AppConfig } from "./config.js";

export interface Wiring {
  ports: Ports;
  /** What the profile (or an override) created and has to be shut down, in creation order. */
  closables: Closable[];
}

export type Profile = (config: AppConfig, overrides: Partial<Ports>) => Wiring;

/**
 * Registers the closable ports of a profile as they are created, so `Wiring.closables` is the
 * creation order and the composition root can shut them down in reverse without inspecting
 * the ports object.
 */
export function tracker(): { own: <T>(port: T) => T; closables: Closable[] } {
  const closables: Closable[] = [];
  return {
    closables,
    own: (port) => {
      if (isClosable(port)) closables.push(port);
      return port;
    },
  };
}
