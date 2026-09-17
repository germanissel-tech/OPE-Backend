// A module wires itself (ADR-013, amendment): from the ports it declares it instantiates its own
// use cases and hands back the controllers, security handlers and policies it serves. The
// composition root keeps the list of modules, never the list of operations: a new operation
// touches the file of its module; a new module is one entry in `MODULES`, like in `CONTEXT_MAP`.
import type { ContractDocument } from "../infrastructure/http/build-server.js";
import type { CorsPolicy } from "../infrastructure/http/cors.js";
import type { Handlers, SecurityHandler } from "../interface-adapters/http/typed.js";

export interface ModuleContext<P> {
  ports: P;
  /** The published contract the server is governed by (version, operations, examples). */
  contract: ContractDocument;
}

/** What one module contributes to the server. Every field is optional: a module may only serve a policy. */
export interface ModuleWiring {
  handlers?: Handlers;
  security?: Readonly<Record<string, SecurityHandler>>;
  cors?: CorsPolicy;
}

/** A module declares the slice of ports it needs (`P`); the root proves `Ports` covers every slice. */
export type Module<P> = (context: ModuleContext<P>) => ModuleWiring;

export interface Wired {
  handlers: Handlers;
  security: Record<string, SecurityHandler>;
  cors?: CorsPolicy;
}

/** Copies `source` into `target` refusing to overwrite: two modules claiming one key is a wiring error. */
function claim<T>(target: Record<string, T>, source: Readonly<Record<string, T>>, what: string): void {
  for (const [key, value] of Object.entries(source)) {
    if (key in target) throw new Error(`Two modules wire the ${what} "${key}".`);
    target[key] = value;
  }
}

/** Runs every module on the same context and merges what they serve; a key claimed twice throws. */
export function wireModules<P>(modules: readonly Module<P>[], context: ModuleContext<P>): Wired {
  const handlers: Record<string, Handlers[keyof Handlers]> = {};
  const security: Record<string, SecurityHandler> = {};
  let cors: CorsPolicy | undefined;
  for (const module of modules) {
    const wiring = module(context);
    claim(handlers, wiring.handlers ?? {}, "operation");
    claim(security, wiring.security ?? {}, "security scheme");
    if (wiring.cors) {
      if (cors) throw new Error("Two modules declare the CORS policy.");
      cors = wiring.cors;
    }
  }
  return { handlers, security, ...(cors ? { cors } : {}) };
}
