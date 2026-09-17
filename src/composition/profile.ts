// A profile is one deployment: it composes, module by module, which implementation serves each
// port (ADR-013, amendment). The bindings themselves live with their module
// (`modules/<module>.ts`: `memoryLedgerPorts`, later `postgresLedgerPorts(pool)`); the profile
// only picks one binding table per module, so a mixed deployment (Postgres for ledgers, Redis
// for dedup, configuration for merchants) is the normal shape, not a special case. The profile
// owns two things the composition root must not guess: which override replaces which gateway,
// and the order in which what it built has to be closed.
import { isClosable, type Closable, type Ports } from "./ports.js";
import type { AppConfig } from "./config.js";
import type { Bindings } from "./wiring.js";

export interface Wiring {
  ports: Ports;
  /** What the profile (or an override) created and has to be shut down, in creation order. */
  closables: Closable[];
}

export type Profile = (config: AppConfig, overrides: Partial<Ports>) => Wiring;

/**
 * Builds ports from binding tables, taking the override when there is one, and registers every
 * closable port as it is created so `Wiring.closables` is the creation order and the composition
 * root can shut them down in reverse without inspecting the ports object.
 */
export function binder(overrides: Partial<Ports>): {
  bind: <P extends Partial<Ports>>(bindings: Bindings<P>) => P;
  closables: Closable[];
} {
  const closables: Closable[] = [];
  const own = <T>(port: T): T => {
    if (isClosable(port)) closables.push(port);
    return port;
  };
  return {
    closables,
    bind: <P extends Partial<Ports>>(bindings: Bindings<P>): P => {
      const built: Partial<Record<keyof P, unknown>> = {};
      for (const key of Object.keys(bindings) as (keyof P & keyof Ports)[]) {
        built[key] = own(overrides[key] ?? bindings[key]());
      }
      return built as P;
    },
  };
}
