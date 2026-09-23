// A module of composition exports exactly three things (ADR-033): what it **provides** (its
// components, one table per technology; the deployment picks one), what it **exposes** to other
// modules (built out of the former, the same in every deployment) and what it **serves** to the
// server. All three are optional: a module that serves no operation omits that part instead of
// returning an empty object to appear in a list.
//
// What it *needs* is not a list: it is the ports it imports and names inside its builders. A list
// written by hand can go stale and lie; an import cannot, and the context map judges it.
//
// The library knows the three shapes the server is wired with (handlers, security schemes, CORS)
// and nothing about any feature module: those types come from the contract, not from a module.
import type { Binding, ProvidesOf, RequiresOf } from "./binding.js";
import type { AnyPort, Label, Needs, Resolved } from "./port.js";
import type { CorsPolicy } from "../../infrastructure/http/cors.js";
import type { Handlers, SecurityScheme } from "../../interface-adapters/http/typed.js";

declare const PROVIDED: unique symbol;
declare const REQUIRED: unique symbol;
declare const SERVED_OPERATIONS: unique symbol;
declare const BUILT: unique symbol;

/**
 * Something a module serves, built from the components it names. What it builds travels as a
 * phantom —the builder itself is stored widened, the way a binding is— so that a recipe written
 * for one operation cannot be put in the slot of another.
 */
export interface Recipe<T, Requires extends string = string> {
  readonly needs: Needs;
  readonly build: (resolved: never) => unknown;
  readonly [BUILT]?: T;
  readonly [REQUIRED]?: Requires;
}

/**
 * A handler: its builder also receives the operationId, which the key of the map gives (FR-022).
 * The stored builder is widened like any other —the instance calls it with the operation first and
 * then what the recipe needs—; `handler()` below is what types the author's side of it.
 */
export interface HandlerRecipe<T, Requires extends string = string> {
  readonly needs: Needs;
  readonly build: (...args: never[]) => unknown;
  readonly [BUILT]?: T;
  readonly [REQUIRED]?: Requires;
}

export function uses<T, const D extends Needs>(
  needs: D,
  build: (resolved: Resolved<D>) => T,
): Recipe<T, Label<D[keyof D]>> {
  return { needs, build };
}

export function handler<T, const D extends Needs>(
  needs: D,
  build: (operation: string, resolved: Resolved<D>) => T,
): HandlerRecipe<T, Label<D[keyof D]>> {
  return { needs, build };
}

/** What a module contributes to the server. The key of a handler is its operationId. */
export interface Serves {
  readonly handlers?: { readonly [Id in keyof Handlers]?: HandlerRecipe<NonNullable<Handlers[Id]>> };
  readonly security?: Readonly<Record<string, Recipe<SecurityScheme>>>;
  readonly cors?: Recipe<CorsPolicy>;
}

export interface ModuleShape {
  /** Its components, one table of bindings per technology; every table serves the same ports. */
  readonly provides?: Readonly<Record<string, readonly Binding[]>>;
  /** What it builds out of those, the same in every deployment. */
  readonly exposes?: readonly Binding[];
  /** What it contributes to the server. */
  readonly serves?: Serves;
}

/** What a module leaves out of one of its technologies: a component the others do serve. */
export interface TechnologiesDisagree<L extends string> {
  readonly notServedByEveryTechnology: L;
}

/** What a deployment has to say when a module can be served in more than one way. */
export interface ChooseATechnology<Names extends string> {
  readonly chooseOneTechnology: Names;
}

type Tables = Readonly<Record<string, readonly Binding[]>>;
type Names<M extends ModuleShape> = M["provides"] extends Tables ? keyof M["provides"] & string : never;
type Bindings<M extends ModuleShape, K extends Names<M>> = M["provides"] extends Tables
  ? M["provides"][K] extends readonly (infer B)[]
    ? B
    : never
  : never;
type Exposed<M extends ModuleShape> = M["exposes"] extends readonly Binding[] ? M["exposes"][number] : never;

/** `"memory"` is not a union; `"memory" | "postgres"` is. */
type IsUnion<T, U = T> = T extends unknown ? ([U] extends [T] ? false : true) : never;

/** Every label some technology of the module provides. */
type Provided<M extends ModuleShape> = ProvidesOf<Bindings<M, Names<M>>>;

/** What a technology leaves out of what the others provide; empty when there is only one. */
type Divergence<M extends ModuleShape> = {
  [K in Names<M>]: Exclude<Provided<M>, ProvidesOf<Bindings<M, K>>>;
}[Names<M>];

type RequiresOfRecipe<R> = R extends Recipe<unknown, infer N> ? N : never;
type RequiresOfHandler<R> = R extends HandlerRecipe<unknown, infer N> ? N : never;
type RequiresOfServes<S> = S extends Serves
  ? | RequiresOfHandler<NonNullable<S["handlers"]>[keyof NonNullable<S["handlers"]>]>
    | RequiresOfRecipe<NonNullable<S["security"]>[keyof NonNullable<S["security"]>]>
    | RequiresOfRecipe<S["cors"]>
  : never;
type OperationsOf<M extends ModuleShape> = M["serves"] extends Serves
  ? keyof NonNullable<M["serves"]["handlers"]> & keyof Handlers
  : never;

/** One module of a deployment, with its technology already chosen. */
export interface Deployed<
  Provides extends string,
  Requires extends string,
  Operations extends keyof Handlers,
> {
  readonly bindings: readonly Binding[];
  /** What the chosen technology provides: the leaves of this module, which a test may replace. */
  readonly provided: readonly AnyPort[];
  readonly serves: Serves;
  readonly [PROVIDED]?: Provides;
  readonly [REQUIRED]?: Requires;
  readonly [SERVED_OPERATIONS]?: Operations;
}

type Chosen<M extends ModuleShape, K extends Names<M>> = Deployed<
  ProvidesOf<Bindings<M, K>> | ProvidesOf<Exposed<M>>,
  RequiresOf<Bindings<M, K>> | RequiresOf<Exposed<M>> | RequiresOfServes<M["serves"]>,
  OperationsOf<M>
>;

/**
 * A module of composition. When it can be served in one way only there is nothing to decide and
 * the deployment takes it as it is; when it declares more than one technology, the deployment has
 * to name which one and the compiler asks for it. The question appears the day it exists.
 */
export type CompositionModule<M extends ModuleShape> = (IsUnion<Names<M>> extends true
  ? ChooseATechnology<Names<M>>
  : Chosen<M, Names<M>>) & {
  with<K extends Names<M>>(name: K): Chosen<M, K>;
};

export function compositionModule<const M extends ModuleShape>(
  shape: M & (Divergence<M> extends never ? unknown : TechnologiesDisagree<Divergence<M>>),
): CompositionModule<M> {
  const declared: ModuleShape = shape;
  const technologies = declared.provides ?? {};
  const chosen = (name: string): Deployed<string, string, keyof Handlers> => {
    const bindings = technologies[name] ?? [];
    return {
      bindings: [...bindings, ...(declared.exposes ?? [])],
      provided: bindings.flatMap((binding) => binding.ports),
      serves: declared.serves ?? {},
    };
  };
  const [only] = Object.keys(technologies);
  // The fields of the first technology are always here; the type is what decides whether a
  // deployment may read them without choosing one first.
  return { ...chosen(only ?? ""), with: chosen } as unknown as CompositionModule<M>;
}
