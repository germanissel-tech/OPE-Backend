// A component of the graph (ADR-033): declared once by the module that owns it, exported, and
// imported by whoever needs it. The label travels in the type so the compiler and the boot can
// name it; it is never compared, and resolution uses the object itself as the key. Consequence
// wanted: consuming something of another module is an import, which dependency-cruiser can judge.

declare const SERVED: unique symbol;

export interface Port<T, L extends string = string> {
  readonly label: L;
  /**
   * Phantom: carries what the port serves in the type and is never assigned at runtime (`port()`
   * below builds `{ label }` and nothing else).
   *
   * It has to be an **optional property**, not a method and not a required one. A property in this
   * position is covariant, so `Port<MerchantStore>` is assignable to `Port<unknown>` and every port
   * fits `AnyPort` — which is what lets a list of unrelated ports be one array. Written as
   * `[SERVED](): T` it would be a method, methods are compared bivariantly and the surrounding
   * interface stops being assignable the way the graph needs (the spike hit seven TS2352/TS2375
   * this way; research R-03). Optional, because no value ever carries the key.
   */
  readonly [SERVED]?: T;
}

/** Any port, whatever it serves. */
export type AnyPort = Port<unknown>;

/** What a port serves. */
export type Served<P> = P extends Port<infer T> ? T : never;

/** The label of a port. */
export type Label<P> = P extends Port<unknown, infer L> ? L : never;

/** What a builder declares it needs: a name for each component, so nothing depends on an order. */
export type Needs = Readonly<Record<string, AnyPort>>;

/** What those needs resolve to: the same names, with the components behind them. */
export type Resolved<D extends Needs> = { readonly [K in keyof D]: Served<D[K]> };

/**
 * Declares a component. Curried so the label is inferred as a literal and what the port serves is
 * given explicitly: `port("merchant.store")<MerchantStore>()`.
 */
export const port =
  <const L extends string>(label: L) =>
  <T>(): Port<T, L> => ({ label });

/** A gateway may need to shut down (connections, timers). In memory there is nothing to close. */
export interface Closable {
  close(): Promise<void> | void;
}

export function isClosable(value: unknown): value is Closable {
  return typeof value === "object" && value !== null && "close" in value && typeof value.close === "function";
}
