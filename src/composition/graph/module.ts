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
import type { AuditedUseCaseReaders, UseCase } from "../../application/shared-kernel/index.js";
import type { CorsPolicy } from "../../infrastructure/http/cors.js";
import type { Handlers, SecurityScheme } from "../../interface-adapters/http/typed.js";

declare const PROVIDED: unique symbol;
declare const REQUIRED: unique symbol;
declare const SERVED_OPERATIONS: unique symbol;
declare const BUILT: unique symbol;
declare const REQUEST: unique symbol;

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
 * What the key of the slot says it is, built **from** these components: the key names the thing
 * (`cors`, the name of a security scheme) and this names where it comes from, the way `served()`
 * does for an operation.
 */
export function from<T, const D extends Needs>(
  needs: D,
  build: (resolved: Resolved<D>) => T,
): Recipe<T, Label<D[keyof D]>> {
  return { needs, build };
}

/**
 * How a use case reaches the server: the name the operational log prints —the name of the **use
 * case**, which in two operations is not the operationId— and, when the contract orders the
 * operation audited, what the administration entry reads from the request and the response.
 * Nothing here says *whether* it is audited: that the contract decides.
 */
export interface Decorated<Request, Response> {
  readonly name: string;
  readonly operation: string;
  readonly audited: boolean;
  readonly readers?: AuditedUseCaseReaders<Request, Response> | undefined;
}

/**
 * What wraps every use case the server runs. The library knows the shape and nothing else: the
 * clock, the logger and the audit trail belong to the kernel, which is the module that provides
 * this. So no handler asks for them, and no handler chooses.
 */
export interface Decoration {
  wrap: <Request, Response>(
    useCase: UseCase<Request, Response>,
    how: Decorated<Request, Response>,
  ) => UseCase<Request, Response>;
}

/**
 * One operation served: what it needs, the use case that resolves it and the controller that
 * translates it. The controller receives the use case **already wrapped**. The request of the use
 * case travels as a phantom so that an operation the contract orders audited cannot be served by
 * a use case that carries no operator.
 */
export interface ServedRecipe<T, Requires extends string = string, Request = unknown> {
  readonly needs: Needs;
  readonly useCase: { readonly name: string; readonly build: (resolved: never) => unknown };
  readonly controller: (...args: never[]) => unknown;
  readonly readers?: unknown;
  readonly [BUILT]?: T;
  readonly [REQUIRED]?: Requires;
  readonly [REQUEST]?: Request;
}

export function served<Request, Response, T, const D extends Needs>(
  needs: D,
  useCase: { name: string; build: (resolved: Resolved<D>) => UseCase<Request, Response> },
  controller: (useCase: UseCase<Request, Response>, resolved: Resolved<D>) => T,
  readers?: AuditedUseCaseReaders<Request, Response>,
): ServedRecipe<T, Label<D[keyof D]>, Request> {
  return { needs, useCase, controller, ...(readers === undefined ? {} : { readers }) };
}

/** What a module contributes to the server. The key of a handler is its operationId. */
export interface Serves {
  readonly handlers?: { readonly [Id in keyof Handlers]?: ServedRecipe<NonNullable<Handlers[Id]>> };
  readonly security?: Readonly<Record<string, Recipe<SecurityScheme>>>;
  readonly cors?: Recipe<CorsPolicy>;
  /** What wraps every use case the server runs; exactly one module of a deployment declares it. */
  readonly decoration?: Recipe<Decoration>;
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

/**
 * Is `T` a union of more than one member? `"memory"` is not; `"memory" | "postgres"` is.
 *
 * `U = T` keeps a copy of the whole union, because the outer conditional is distributive and its
 * `T` is one member at a time. So the inner comparison asks "is the whole union assignable to this
 * one member?": with one member, yes (`false`, not a union); with two, no (`true`). The brackets
 * around `[U] extends [T]` are what stops the inner conditional from distributing too — without
 * them it would compare member against member and always answer `false`.
 */
type IsUnion<T, U = T> = T extends unknown ? ([U] extends [T] ? false : true) : never;

/** Every label some technology of the module provides. */
type Provided<M extends ModuleShape> = ProvidesOf<Bindings<M, Names<M>>>;

/**
 * What a technology leaves out of what the others provide; empty when there is only one.
 *
 * The mapped type computes the answer per technology and indexing it by `Names<M>` folds those
 * answers into one union — the idiom for "the union of the values of a mapped type". With one
 * technology, `Provided<M>` is exactly what it provides and the `Exclude` is `never`.
 */
type Divergence<M extends ModuleShape> = {
  [K in Names<M>]: Exclude<Provided<M>, ProvidesOf<Bindings<M, K>>>;
}[Names<M>];

// What `serves` needs, read out of the recipes in its three slots. Each alias takes a naked type
// parameter so a union of recipes yields a union of labels; `X[keyof X]` is again the union of the
// values of a record — every handler of the map, every security scheme of the map.
type RequiresOfRecipe<R> = R extends Recipe<unknown, infer N> ? N : never;
type RequiresOfServed<R> = R extends ServedRecipe<unknown, infer N> ? N : never;
type RequiresOfServes<S> = S extends Serves
  ? | RequiresOfServed<NonNullable<S["handlers"]>[keyof NonNullable<S["handlers"]>]>
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
 * A module of composition, in one of three states. Served in one way (no technology names at all)
 * or in one named way, it is a `Deployed` and a deployment takes it as it is; declaring two or
 * more, it is `ChooseATechnology`, which a deployment does not accept, and `with(name)` is how the
 * caller turns it into a `Deployed`.
 *
 * The first branch tests `[Names<M>] extends [never]`, in brackets, and the order matters. When a
 * module lists its bindings, `Names<M>` is `never`, and `never` is assignable to everything —
 * including `true` — so asking `IsUnion<Names<M>> extends true` first would answer "yes, choose a
 * technology" for the very modules that have none to choose. The brackets stop the distribution
 * that makes `never` vanish and let the case be caught before the union test runs.
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
  // Both shapes are handled as one table: a list is stored under the empty name, which no author
  // can write, so the code below has a single case and the empty name never reaches a deployment.
  const technologies: Tables = Array.isArray(provides) ? { "": provides } : (provides as Tables);
  const chosen = (name: string): Deployed<string, string, keyof Handlers> => {
    const bindings = technologies[name] ?? [];
    return {
      bindings: [...bindings, ...(declared.assembles ?? [])],
      provided: bindings.flatMap((binding) => binding.ports),
      serves: declared.serves ?? {},
    };
  };
  // The returned object always carries the fields of the first technology —the only one, when
  // there is one, and the empty name when the module listed its bindings— alongside `with`. It is
  // the **type** that decides who may read them: with two technologies `CompositionModule` is
  // `ChooseATechnology`, which has no `bindings`, so a deployment cannot take the first by
  // accident and has to call `with`. The cast is where that reasoning leaves the compiler.
  const [only] = Object.keys(technologies);
  return { ...chosen(only ?? ""), with: chosen } as unknown as CompositionModule<M>;
}
