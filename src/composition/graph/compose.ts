// The deployment and its instance (ADR-033). A deployment is a description —the list of modules
// with the technology chosen for each— and it does not compile if a requirement is left without a
// provider or if an operation the contract declares is left without a handler. Instantiating it
// builds a graph of that boot: lazy, memoised, one instance per component, nothing global and
// nothing static, so two boots (two tests) never see each other.
import { isClosable, type AnyPort, type Closable, type Port } from "./port.js";
import type { Binding } from "./binding.js";
import type { Deployed, Serves } from "./module.js";
import type { CorsPolicy } from "../../infrastructure/http/cors.js";
import type { Handlers, SecurityScheme } from "../../interface-adapters/http/typed.js";

/** What a deployment with a hole reports: the labels nobody provides. */
export interface Missing<L extends string> {
  readonly missingComponents: L;
}

/** What a deployment leaves without a handler: the operations the contract declares and nobody serves. */
export interface Unwired<Id extends string> {
  readonly operationsWithoutHandler: Id;
}

type AnyDeployed = Deployed<string, string, keyof Handlers>;
type ProvidedBy<D> = D extends Deployed<infer P, string, keyof Handlers> ? P : never;
type NeededBy<D> = D extends Deployed<string, infer R, keyof Handlers> ? R : never;
type ServedBy<D> = D extends Deployed<string, string, infer O> ? O : never;
type Holes<M extends readonly AnyDeployed[]> = Exclude<NeededBy<M[number]>, ProvidedBy<M[number]>>;
type Unserved<M extends readonly AnyDeployed[]> = Exclude<keyof Handlers, ServedBy<M[number]>> & string;

export interface Deployment<Provides extends string> {
  readonly bindings: readonly Binding[];
  /** What a technology serves, as opposed to what a module composes out of it. */
  readonly technologyPorts: readonly AnyPort[];
  readonly serves: readonly Serves[];
  readonly provides?: Provides;
}

/**
 * The list of modules of one deployment, with no significant order: resolution is by dependency.
 * A requirement without a provider reports `Missing<…>`; an operation without a handler,
 * `Unwired<…>`.
 */
export function deployment<const M extends readonly AnyDeployed[]>(
  modules: M &
    (Holes<M> extends never ? unknown : Missing<Holes<M>>) &
    (Unserved<M> extends never ? unknown : Unwired<Unserved<M>>),
): Deployment<ProvidedBy<M[number]>> {
  const chosen = modules as readonly AnyDeployed[];
  return {
    bindings: chosen.flatMap((module) => module.bindings),
    technologyPorts: chosen.flatMap((module) => module.technologyPorts),
    serves: chosen.map((module) => module.serves),
  };
}

/** A component replaced for one boot: a double in a test, the fixed clock. */
export interface Override {
  readonly port: AnyPort;
  readonly value: unknown;
}

export function replace<T, L extends string>(target: Port<T, L>, value: T): Override {
  return { port: target, value };
}

/** What the modules of a deployment contribute to the server, once resolved. */
export interface Wired {
  handlers: Handlers;
  security: Record<string, SecurityScheme>;
  cors?: CorsPolicy;
}

export interface Instance<Provides extends string> {
  /** The component, built at most once for this boot. */
  resolve: <T, L extends Provides>(target: Port<T, L>) => T;
  /** Builds everything the deployment binds: fixes creation order and finds a cycle at boot. */
  resolveAll: () => void;
  /** The ports of this deployment, in the order the bindings declare them. */
  ports: readonly AnyPort[];
  /** What was built and knows how to close, in creation order; the boot closes in reverse. */
  closables: readonly Closable[];
  /** Resolves what the modules serve. */
  wire: () => Wired;
}

/** Anything the modules serve: what it needs and a builder the instance calls with it. */
interface Cookable {
  readonly needs: Readonly<Record<string, AnyPort>>;
  readonly build: (...args: never[]) => unknown;
}

/** Writes one key refusing to overwrite: two modules claiming one is a wiring error. */
function claim<T>(target: Record<string, T>, key: string, value: T, what: string): void {
  if (key in target) throw new Error(`Two modules wire the ${what} "${key}".`);
  target[key] = value;
}

function tableOf(bindings: readonly Binding[], overrides: readonly Override[]): Map<AnyPort, Binding> {
  const table = new Map<AnyPort, Binding>();
  for (const binding of bindings) table.set(binding.port, binding);
  for (const { port, value } of overrides) {
    table.set(port, { port, needs: {}, build: () => value });
  }
  return table;
}

export function instantiate<Provides extends string>(
  plan: Deployment<Provides>,
  overrides: readonly Override[] = [],
): Instance<Provides> {
  const table = tableOf(plan.bindings, overrides);
  const built = new Map<AnyPort, unknown>();
  const closables: Closable[] = [];
  const open: string[] = [];
  const needed = (needs: Readonly<Record<string, AnyPort>>): Record<string, unknown> =>
    Object.fromEntries(Object.entries(needs).map(([name, target]) => [name, resolve(target)]));
  const resolve = (target: AnyPort): unknown => {
    if (built.has(target)) return built.get(target);
    if (open.includes(target.label)) {
      throw new Error(`Cycle in the composition graph: ${[...open, target.label].join(" -> ")}.`);
    }
    const binding = table.get(target);
    if (!binding) throw new Error(`No provider for "${target.label}" in this deployment.`);
    open.push(target.label);
    // The only cast of the library: `bind` already checked the builder against what it needs.
    const value = (binding.build as (resolved: Record<string, unknown>) => unknown)(needed(binding.needs));
    open.pop();
    built.set(target, value);
    if (isClosable(value)) closables.push(value);
    return value;
  };
  // The same boundary as above: what a recipe builds travels as a phantom, and which type it
  // belongs to is what the slot of `Serves` already checked.
  const cook = (recipe: Cookable, ...first: readonly string[]): unknown =>
    (recipe.build as (...rest: readonly unknown[]) => unknown)(...first, needed(recipe.needs));
  const handlers: Record<string, unknown> = {};
  const security: Record<string, SecurityScheme> = {};
  let cors: CorsPolicy | undefined;
  const serve = (serves: Serves): void => {
    for (const [id, recipe] of Object.entries(serves.handlers ?? {})) {
      claim(handlers, id, cook(recipe, id), "operation");
    }
    for (const [name, recipe] of Object.entries(serves.security ?? {})) {
      claim(security, name, cook(recipe) as SecurityScheme, "security scheme");
    }
    if (serves.cors) {
      if (cors) throw new Error("Two modules declare the CORS policy.");
      cors = cook(serves.cors) as CorsPolicy;
    }
  };
  return {
    resolve: <T, L extends Provides>(target: Port<T, L>): T => resolve(target) as T,
    resolveAll: () => {
      for (const binding of plan.bindings) resolve(binding.port);
    },
    ports: [...table.keys()],
    closables,
    wire: (): Wired => {
      for (const serves of plan.serves) serve(serves);
      return { handlers, security, ...(cors ? { cors } : {}) };
    },
  };
}
