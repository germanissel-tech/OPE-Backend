// A module of composition exports exactly three things (ADR-033): the binding tables of its own
// ports, one per technology; what it exposes to other modules, the same in every deployment; and
// what it serves to the server. All three are optional, so a module that serves no operation omits
// that part instead of returning an empty object to appear in a list.
//
// The library knows the three shapes the server is wired with (handlers, security schemes, CORS)
// and nothing about any feature module: those types come from the contract, not from a module.
import type { Binding, NeedsOf, ProvidesOf } from "./binding.js";
import type { AnyPort, Label, Values } from "./port.js";
import type { CorsPolicy } from "../../infrastructure/http/cors.js";
import type { Handlers, SecurityScheme } from "../../interface-adapters/http/typed.js";

declare const PROVIDED: unique symbol;
declare const REQUIRED: unique symbol;
declare const SERVED_OPERATIONS: unique symbol;
declare const BUILT: unique symbol;

/** What a technology table of a module leaves unserved: the ports it declares and does not build. */
export interface Unserved<L extends string> {
  readonly unservedPorts: L;
}

/** The set of bindings with which one technology serves the ports of a module. */
export interface Technology<Provides extends string, Needs extends string> {
  readonly bindings: readonly Binding[];
  readonly [PROVIDED]?: Provides;
  readonly [REQUIRED]?: Needs;
}

/**
 * Declares how a technology serves the ports of a module. It does not compile if the table misses
 * one of the ports the module declares; it may also serve a port another module declares, when the
 * context map lets this module see it (the consumer declares its read port, whoever can resolve it
 * binds it).
 */
export function technology<const P extends readonly AnyPort[], const B extends readonly Binding[]>(
  ports: P,
  bindings: B &
    (Exclude<Label<P[number]>, ProvidesOf<B[number]>> extends never
      ? unknown
      : Unserved<Exclude<Label<P[number]>, ProvidesOf<B[number]>>>),
): Technology<ProvidesOf<B[number]>, NeedsOf<B[number]>> {
  return { bindings };
}

/**
 * Something a module serves, built from the components it names. What it builds travels as a
 * phantom —the builder itself is stored widened, the way a binding is— so that a recipe written
 * for one operation cannot be put in the slot of another.
 */
export interface Recipe<T, Needs extends string = string> {
  readonly deps: readonly AnyPort[];
  readonly build: (...args: never[]) => unknown;
  readonly [BUILT]?: T;
  readonly [REQUIRED]?: Needs;
}

/**
 * A handler: its builder also receives the operationId, which the key of the map gives (FR-022).
 * The stored builder is widened like any other —the instance calls it with the operation first and
 * then the resolved components—; `handler()` below is what types the author's side of it.
 */
export interface HandlerRecipe<T, Needs extends string = string> {
  readonly deps: readonly AnyPort[];
  readonly build: (...args: never[]) => unknown;
  readonly [BUILT]?: T;
  readonly [REQUIRED]?: Needs;
}

export function uses<T, const D extends readonly AnyPort[]>(
  deps: D,
  build: (...args: Values<D>) => T,
): Recipe<T, Label<D[number]>> {
  return { deps, build };
}

export function handler<T, const D extends readonly AnyPort[]>(
  deps: D,
  build: (operation: string, ...args: Values<D>) => T,
): HandlerRecipe<T, Label<D[number]>> {
  return { deps, build };
}

/** What a module contributes to the server. The key of a handler is its operationId. */
export interface Serves {
  readonly handlers?: { readonly [Id in keyof Handlers]?: HandlerRecipe<NonNullable<Handlers[Id]>> };
  readonly security?: Readonly<Record<string, Recipe<SecurityScheme>>>;
  readonly cors?: Recipe<CorsPolicy>;
}

export interface ModuleShape {
  /** The ports this module declares; a technology table that misses one does not compile. */
  readonly ports: readonly AnyPort[];
  readonly technologies: Readonly<Record<string, Technology<string, string>>>;
  readonly exposes?: readonly Binding[];
  readonly serves?: Serves;
}

type NeedsOfRecipe<R> = R extends Recipe<unknown, infer N> ? N : never;
type NeedsOfHandler<R> = R extends HandlerRecipe<unknown, infer N> ? N : never;
type NeedsOfServes<S> = S extends Serves
  ? | NeedsOfHandler<NonNullable<S["handlers"]>[keyof NonNullable<S["handlers"]>]>
    | NeedsOfRecipe<NonNullable<S["security"]>[keyof NonNullable<S["security"]>]>
    | NeedsOfRecipe<S["cors"]>
  : never;

type Exposed<M extends ModuleShape> = M["exposes"] extends readonly Binding[] ? M["exposes"][number] : never;
type Chosen<M extends ModuleShape, K extends keyof M["technologies"]> = M["technologies"][K];
type OperationsOf<M extends ModuleShape> = M["serves"] extends Serves
  ? keyof NonNullable<M["serves"]["handlers"]> & keyof Handlers
  : never;

/** One module of a deployment, with its technology already chosen. */
export interface Deployed<Provides extends string, Needs extends string, Operations extends keyof Handlers> {
  readonly bindings: readonly Binding[];
  readonly serves: Serves;
  readonly [PROVIDED]?: Provides;
  readonly [REQUIRED]?: Needs;
  readonly [SERVED_OPERATIONS]?: Operations;
}

export interface CompositionModule<M extends ModuleShape> {
  /** Picks one of this module's technologies. A name that is not one of them does not compile. */
  with<K extends keyof M["technologies"] & string>(
    name: K,
  ): Deployed<
    (Chosen<M, K> extends Technology<infer P, string> ? P : never) | ProvidesOf<Exposed<M>>,
    | (Chosen<M, K> extends Technology<string, infer N> ? N : never)
    | NeedsOf<Exposed<M>>
    | NeedsOfServes<M["serves"]>,
    OperationsOf<M>
  >;
}

export function compositionModule<const M extends ModuleShape>(shape: M): CompositionModule<M> {
  return {
    with: (name) => ({
      bindings: [...(shape.technologies[name]?.bindings ?? []), ...(shape.exposes ?? [])],
      serves: shape.serves ?? {},
    }),
  };
}
