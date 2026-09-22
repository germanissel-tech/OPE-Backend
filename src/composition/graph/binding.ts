// How one component is built (ADR-033): which port it serves, which components it needs —by name,
// never by position— and the builder. The builder receives exactly what it declared, with the
// names it gave, so a dependency added or removed is a compile error and nothing depends on an
// order. There is no access to the graph from inside a builder.
import type { Label, Needs, Port, Resolved } from "./port.js";

declare const REQUIRED: unique symbol;

export interface Binding<Provides extends string = string, Requires extends string = string> {
  readonly port: Port<unknown, Provides>;
  readonly needs: Needs;
  readonly build: (resolved: never) => unknown;
  /** Phantom: the labels this binding needs. Never exists at runtime. */
  readonly [REQUIRED]?: Requires;
}

export function bind<T, L extends string, const D extends Needs>(
  target: Port<T, L>,
  needs: D,
  build: (resolved: Resolved<D>) => T,
): Binding<L, Label<D[keyof D]>> {
  return { port: target, needs, build };
}

/**
 * One instance, two views: the derived port resolves to the very object the source resolved to.
 * `S extends T` makes deriving from an instance that does not satisfy the view a compile error.
 */
export function derive<T, L extends string, S extends T, K extends string>(
  view: Port<T, L>,
  source: Port<S, K>,
): Binding<L, K> {
  return { port: view, needs: { source }, build: ({ source: instance }: { source: S }) => instance };
}

/** What a binding provides, as a distributive alias so a union of bindings yields a union of labels. */
export type ProvidesOf<B> = B extends Binding<infer P> ? P : never;

/** What a binding needs, distributive for the same reason. */
export type RequiresOf<B> = B extends Binding<string, infer R> ? R : never;
