// How one component is built (ADR-033): which port it serves, which ports it needs and the
// builder. The builder's parameters are inferred from the declared dependencies, so an order
// changed or a type that does not correspond does not compile. A builder receives what it asked
// for and nothing else: there is no access to the graph from inside it.
import type { AnyPort, Label, Port, Values } from "./port.js";

declare const REQUIRED: unique symbol;

export interface Binding<Provides extends string = string, Needs extends string = string> {
  readonly port: Port<unknown, Provides>;
  readonly deps: readonly AnyPort[];
  readonly build: (...args: never[]) => unknown;
  /** Phantom: the labels this binding needs. Never exists at runtime. */
  readonly [REQUIRED]?: Needs;
}

export function bind<T, L extends string, const D extends readonly AnyPort[]>(
  target: Port<T, L>,
  deps: D,
  build: (...args: Values<D>) => T,
): Binding<L, Label<D[number]>> {
  return { port: target, deps, build };
}

/**
 * One instance, two views: the derived port resolves to the very object the source resolved to.
 * `S extends T` makes deriving from an instance that does not satisfy the view a compile error.
 */
export function derive<T, L extends string, S extends T, K extends string>(
  view: Port<T, L>,
  source: Port<S, K>,
): Binding<L, K> {
  return { port: view, deps: [source], build: (value: S) => value };
}

/** What a binding provides, as a distributive alias so a union of bindings yields a union of labels. */
export type ProvidesOf<B> = B extends Binding<infer P> ? P : never;

/** What a binding needs, distributive for the same reason. */
export type NeedsOf<B> = B extends Binding<string, infer N> ? N : never;
