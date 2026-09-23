// How one component is built (ADR-033): which port it serves, which components it needs —by name,
// never by position— and the builder. The builder receives exactly what it declared, with the
// names it gave, so a dependency added or removed is a compile error and nothing depends on an
// order. There is no access to the graph from inside a builder.
//
// A binding may serve more than one port: an instance that satisfies two views is bound once and
// resolved once, and the graph hands the same object to both (the merchant store the
// administration writes and the directory the access module reads are one thing).
import type { AnyPort, Label, Needs, Port, Resolved, Served } from "./port.js";

declare const PROVIDED: unique symbol;
declare const REQUIRED: unique symbol;

export interface Binding<Provides extends string = string, Requires extends string = string> {
  /** The ports this binding serves; more than one when an instance satisfies several views. */
  readonly ports: readonly AnyPort[];
  readonly needs: Needs;
  readonly build: (resolved: never) => unknown;
  /** Phantoms: the labels this binding provides and needs. Neither exists at runtime. */
  readonly [PROVIDED]?: Provides;
  readonly [REQUIRED]?: Requires;
}

export function bind<T, L extends string, const D extends Needs>(
  target: Port<T, L>,
  needs: D,
  build: (resolved: Resolved<D>) => T,
): Binding<L, Label<D[keyof D]>> {
  return { ports: [target], needs, build };
}

/** What every port of a list serves, as one type: what a builder of all of them has to return. */
type Everything<U> = (U extends unknown ? (of: U) => void : never) extends (of: infer I) => void ? I : never;

/**
 * One instance, several views: the builder returns something that satisfies every port of the
 * list, and the graph resolves it once and hands the same object to all of them. A value that
 * does not satisfy one of them does not compile.
 */
export function bindAll<const P extends readonly AnyPort[], const D extends Needs>(
  targets: P,
  needs: D,
  build: (resolved: Resolved<D>) => Everything<Served<P[number]>>,
): Binding<Label<P[number]>, Label<D[keyof D]>> {
  return { ports: targets, needs, build };
}

/** What a binding provides, as a distributive alias so a union of bindings yields a union of labels. */
export type ProvidesOf<B> = B extends Binding<infer P> ? P : never;

/** What a binding needs, distributive for the same reason. */
export type RequiresOf<B> = B extends Binding<string, infer R> ? R : never;
