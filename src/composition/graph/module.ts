// A module of composition says exactly three things (ADR-033): what it **provides** (its
// components; a list when it is served in one way, a table per technology when there is something
// to choose), what it **assembles** out of those (the same in every deployment) and what it
// **serves** to the server. All three are optional: a module that serves no operation omits that
// part instead of returning an empty object to appear in a list.
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

/**
 * What the key of the slot says it is, built **from** these components: the key names the thing
 * (`cors`, the name of a security scheme) and this names where it comes from, the way `handler()`
 * does for an operation.
 */
export function from<T, const D extends Needs>(
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
  /**
   * Its components. A module served in one way lists its bindings; one that can be served in
   * several groups them by technology, and then every table has to provide the same components.
   * There is no name to invent until there is something to choose.
   */
  readonly provides?: readonly Binding[] | Readonly<Record<string, readonly Binding[]>>;
  /** What it assembles out of those, the same in every deployment. */
  readonly assembles?: readonly Binding[];
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

/** The technologies a module declares; none when it is served in one way only. */
type Names<M extends ModuleShape> = M["provides"] extends readonly Binding[]
  ? never
  : M["provides"] extends Tables
    ? keyof M["provides"] & string
    : never;

/** What it provides with no technology to choose. */
type OneWay<M extends ModuleShape> = M["provides"] extends readonly Binding[] ? M["provides"][number] : never;

/** What one of its technologies provides. */
type Bindings<M extends ModuleShape, K extends Names<M>> = M["provides"] extends Tables
  ? M["provides"][K] extends readonly (infer B)[]
    ? B
    : never
  : never;

type Assembled<M extends ModuleShape> = M["assembles"] extends readonly Binding[]
  ? M["assembles"][number]
  : never;

/** `"memory"` is not a union; `"memory" | "postgres"` is; no technology at all is neither. */
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
  ProvidesOf<Bindings<M, K> | OneWay<M> | Assembled<M>>,
  RequiresOf<Bindings<M, K> | OneWay<M> | Assembled<M>> | RequiresOfServes<M["serves"]>,
  OperationsOf<M>
>;

/**
 * A module of composition. When it can be served in one way only there is nothing to decide and
 * the deployment takes it as it is; when it declares more than one technology, the deployment has
 * to name which one and the compiler asks for it. The question appears the day it exists.
 */
export type CompositionModule<M extends ModuleShape> = ([Names<M>] extends [never]
  ? Chosen<M, never>
  : IsUnion<Names<M>> extends true
    ? ChooseATechnology<Names<M>>
    : Chosen<M, Names<M>>) & {
  with<K extends Names<M>>(name: K): Chosen<M, K>;
};

export function compositionModule<const M extends ModuleShape>(
  shape: M & (Divergence<M> extends never ? unknown : TechnologiesDisagree<Divergence<M>>),
): CompositionModule<M> {
  const declared: ModuleShape = shape;
  const provides = declared.provides ?? [];
  // One way of being served is a list; several are a table with a name each.
  const technologies: Tables = Array.isArray(provides) ? { "": provides } : (provides as Tables);
  const chosen = (name: string): Deployed<string, string, keyof Handlers> => {
    const bindings = technologies[name] ?? [];
    return {
      bindings: [...bindings, ...(declared.assembles ?? [])],
      provided: bindings.flatMap((binding) => binding.ports),
      serves: declared.serves ?? {},
    };
  };
  const [only] = Object.keys(technologies);
  // The fields of the first technology are always here; the type is what decides whether a
  // deployment may read them without choosing one first.
  return { ...chosen(only ?? ""), with: chosen } as unknown as CompositionModule<M>;
}
