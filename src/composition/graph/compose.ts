// The deployment and its instance (ADR-033). A deployment is a description —the list of modules
// with the technology chosen for each— and it does not compile if a requirement is left without a
// provider or if an operation the contract declares is left without a handler. Instantiating it
// builds a graph of that boot: lazy, memoised, one instance per component, nothing global and
// nothing static, so two boots (two tests) never see each other.
import {
  AUDITED_OPERATIONS,
  type Handlers,
  type SecurityScheme,
} from "../../interface-adapters/http/typed.js";
import { isClosable, type AnyPort, type Closable, type Port } from "./port.js";
import type { Binding } from "./binding.js";
import type { Decoration, Deployed, ServedRecipe, Serves } from "./module.js";
import type { AuditedUseCaseReaders, UseCase } from "../../application/shared-kernel/index.js";
import type { CorsPolicy } from "../../infrastructure/http/cors.js";

/** The contract says which operations leave an entry in the administration log; nobody else does. */
const AUDITED = new Set<string>(AUDITED_OPERATIONS);

/** What a deployment with a hole reports: the labels nobody provides. */
export interface Missing<L extends string> {
  readonly missingComponents: L;
}

/** What a deployment leaves without a handler: the operations the contract declares and nobody serves. */
export interface Unwired<Id extends string> {
  readonly operationsWithoutHandler: Id;
}

// The two checks below are set subtraction over labels. Each module carries three phantoms —what
// it provides, what it needs, which operations it serves— and these aliases read them back out.
// They take a naked type parameter so that `M[number]`, the union of the modules of the list,
// yields the union of all their labels; `Exclude` then says what is left over.
type AnyDeployed = Deployed<string, string, keyof Handlers>;
type ProvidedBy<D> = D extends Deployed<infer P, string, keyof Handlers> ? P : never;
type NeededBy<D> = D extends Deployed<string, infer R, keyof Handlers> ? R : never;
type ServedBy<D> = D extends Deployed<string, string, infer O> ? O : never;
/** Needed by some module of the list and provided by none: the components that are missing. */
type Holes<M extends readonly AnyDeployed[]> = Exclude<NeededBy<M[number]>, ProvidedBy<M[number]>>;
/** Declared by the contract and served by no module of the list: the operations left unwired. */
type Unserved<M extends readonly AnyDeployed[]> = Exclude<keyof Handlers, ServedBy<M[number]>> & string;

export interface Deployment<Provides extends string> {
  readonly bindings: readonly Binding[];
  /** What a technology provides, as opposed to what a module builds out of it. */
  readonly providedPorts: readonly AnyPort[];
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
    providedPorts: chosen.flatMap((module) => module.provided),
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

/**
 * The decoration of a deployment: any of its modules may declare it, every handler needs it, so it
 * is resolved before the first one and never waits for its turn in the list.
 */
function decorationOf(all: readonly Serves[], cook: (recipe: Cookable) => unknown): Decoration | undefined {
  const declared = all.map((serves) => serves.decoration).filter((recipe) => recipe !== undefined);
  if (declared.length > 1) throw new Error("Two modules declare the decoration.");
  const only = declared[0];
  // A deployment that serves no operation needs none; one that serves any is refused below.
  return only === undefined ? undefined : (cook(only) as Decoration);
}

/**
 * One operation: its use case built from what it named, wrapped as the platform wraps every use
 * case it serves, and its controller, which only ever sees the wrapped one.
 */
function servedOperation(
  recipe: ServedRecipe<unknown>,
  id: string,
  decoration: Decoration | undefined,
  needed: (needs: Readonly<Record<string, AnyPort>>) => Record<string, unknown>,
): unknown {
  if (!decoration) throw new Error("No module of this deployment declares the decoration.");
  const resolved = needed(recipe.needs);
  const built = (recipe.useCase.build as (r: Record<string, unknown>) => UseCase<never, never>)(resolved);
  const wrapped = decoration.wrap(built, {
    name: recipe.useCase.name,
    operation: id,
    audited: AUDITED.has(id),
    ...(recipe.readers === undefined
      ? {}
      : { readers: recipe.readers as AuditedUseCaseReaders<never, never> }),
  });
  return (recipe.controller as (u: unknown, r: Record<string, unknown>) => unknown)(wrapped, resolved);
}

/** Writes one key refusing to overwrite: two modules claiming one is a wiring error. */
function claim<T>(target: Record<string, T>, key: string, value: T, what: string): void {
  if (key in target) throw new Error(`Two modules wire the ${what} "${key}".`);
  target[key] = value;
}

function tableOf(bindings: readonly Binding[], overrides: readonly Override[]): Map<AnyPort, Binding> {
  const table = new Map<AnyPort, Binding>();
  for (const binding of bindings) {
    for (const port of binding.ports) table.set(port, binding);
  }
  for (const { port, value } of overrides) {
    table.set(port, { ports: [port], needs: {}, build: () => value });
  }
  return table;
}

export function instantiate<Provides extends string>(
  plan: Deployment<Provides>,
  overrides: readonly Override[] = [],
): Instance<Provides> {
  const table = tableOf(plan.bindings, overrides);
  // Memoised per binding, not per port: an instance that satisfies several views is built once,
  // and every port of its binding answers with that same object.
  const built = new Map<Binding, unknown>();
  const closables: Closable[] = [];
  const open: string[] = [];
  const needed = (needs: Readonly<Record<string, AnyPort>>): Record<string, unknown> =>
    Object.fromEntries(Object.entries(needs).map(([name, target]) => [name, resolve(target)]));
  const resolve = (target: AnyPort): unknown => {
    const binding = table.get(target);
    if (!binding) throw new Error(`No provider for "${target.label}" in this deployment.`);
    if (built.has(binding)) return built.get(binding);
    if (open.includes(target.label)) {
      throw new Error(`Cycle in the composition graph: ${[...open, target.label].join(" -> ")}.`);
    }
    open.push(target.label);
    // The only cast of the library: `bind` already checked the builder against what it needs.
    const value = (binding.build as (resolved: Record<string, unknown>) => unknown)(needed(binding.needs));
    open.pop();
    built.set(binding, value);
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
  const serve = (serves: Serves, decoration: Decoration | undefined): void => {
    for (const [id, recipe] of Object.entries(serves.handlers ?? {})) {
      claim(handlers, id, servedOperation(recipe, id, decoration, needed), "operation");
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
      for (const binding of plan.bindings) {
        for (const port of binding.ports) resolve(port);
      }
    },
    ports: [...table.keys()],
    closables,
    wire: (): Wired => {
      const decoration = decorationOf(plan.serves, cook);
      for (const serves of plan.serves) serve(serves, decoration);
      return { handlers, security, ...(cors ? { cors } : {}) };
    },
  };
}
