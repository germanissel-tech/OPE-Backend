// Behavioural signals (01-arquitectura-mvp.md §4.2; ADR-026): what a sequence of events adds up
// to, in the closed vocabulary the barrier rules can name. Counts per event key (the type, and
// `type:subtype` for the types that have one), dwell per block, and the first and last instant
// per key so that "a happened before b" is exact. A monoid: the batch is aggregated once and
// merged into the session; the same value serves both.
import { MS_PER_SECOND, type Branded } from "../shared-kernel/index.js";
import type { Block, Event, EventType } from "../ingestion/index.js";

/** `type` or `type:subtype`; the subtype is the closed refining field of the type (SUBTYPES). */
export type EventKey = Branded<string, "EventKey">;

/** A reference to an event kind in a rule: the type, optionally refined by its subtype. */
export interface EventRef {
  type: EventType;
  subtype?: string;
}

const KEY_SEPARATOR = ":";

export class Signals {
  readonly #counts: ReadonlyMap<EventKey, number>;
  readonly #dwellMs: ReadonlyMap<Block, number>;
  readonly #firstAt: ReadonlyMap<EventKey, number>;
  readonly #lastAt: ReadonlyMap<EventKey, number>;

  private constructor(
    counts: ReadonlyMap<EventKey, number>,
    dwellMs: ReadonlyMap<Block, number>,
    firstAt: ReadonlyMap<EventKey, number>,
    lastAt: ReadonlyMap<EventKey, number>,
  ) {
    this.#counts = counts;
    this.#dwellMs = dwellMs;
    this.#firstAt = firstAt;
    this.#lastAt = lastAt;
  }

  static keyOf(ref: EventRef): EventKey {
    return (ref.subtype === undefined ? ref.type : `${ref.type}${KEY_SEPARATOR}${ref.subtype}`) as EventKey;
  }

  /** The identity of `merge`: no event was seen. */
  static empty(): Signals {
    return new Signals(new Map(), new Map(), new Map(), new Map());
  }

  /** The signals of these events, in any order: every event counts by its type and, when it has one, by `type:subtype`. */
  static of(events: readonly Event[]): Signals {
    const counts = new Map<EventKey, number>();
    const dwellMs = new Map<Block, number>();
    const firstAt = new Map<EventKey, number>();
    const lastAt = new Map<EventKey, number>();
    const see = (key: EventKey, at: number): void => {
      counts.set(key, (counts.get(key) ?? 0) + 1);
      firstAt.set(key, Math.min(firstAt.get(key) ?? at, at));
      lastAt.set(key, Math.max(lastAt.get(key) ?? at, at));
    };
    for (const event of events) {
      const at = event.occurredAt.getTime();
      see(Signals.keyOf({ type: event.type }), at);
      const subtype = subtypeOf(event);
      if (subtype !== undefined) see(Signals.keyOf({ type: event.type, subtype }), at);
      if (event.type === "block_dwelled")
        dwellMs.set(event.block, (dwellMs.get(event.block) ?? 0) + event.dwellMs);
    }
    return new Signals(counts, dwellMs, firstAt, lastAt);
  }

  /** Both seen: counts and dwell add up; the first instant is the earliest, the last the latest. */
  merge(other: Signals): Signals {
    return new Signals(
      combine(this.#counts, other.#counts, (a, b) => a + b),
      combine(this.#dwellMs, other.#dwellMs, (a, b) => a + b),
      combine(this.#firstAt, other.#firstAt, Math.min),
      combine(this.#lastAt, other.#lastAt, Math.max),
    );
  }

  count(ref: EventRef): number {
    return this.#counts.get(Signals.keyOf(ref)) ?? 0;
  }

  dwellSeconds(block: Block): number {
    return (this.#dwellMs.get(block) ?? 0) / MS_PER_SECOND;
  }

  /** Some `first` happened strictly before some `then`; false when either was never seen. */
  sequence(first: EventRef, then: EventRef): boolean {
    const a = this.#firstAt.get(Signals.keyOf(first));
    const b = this.#lastAt.get(Signals.keyOf(then));
    return a !== undefined && b !== undefined && a < b;
  }

  /** Nothing was seen: the identity of `merge`. */
  isEmpty(): boolean {
    return this.#counts.size === 0;
  }
}

/** The closed refining field of an event, when its type has one (SUBTYPES in the ingestion module). */
function subtypeOf(event: Event): string | undefined {
  switch (event.type) {
    case "photo_interacted":
      return event.interaction;
    case "block_dwelled":
      return event.block;
    case "cta_approached":
      return event.approach;
    case "checkout_advanced":
      return event.step;
    case "exit_signaled":
      return event.signal;
    case "product_viewed":
    case "listing_viewed":
    case "size_selector_interacted":
    case "variant_selected":
    case "product_returned_to":
    case "added_to_cart":
    // Stryker disable next-line ConditionalExpression: emptied, the last case falls through to the end of the switch and yields undefined all the same
    case "removed_from_cart":
      return undefined;
  }
}

function combine<K>(
  a: ReadonlyMap<K, number>,
  b: ReadonlyMap<K, number>,
  join: (x: number, y: number) => number,
): ReadonlyMap<K, number> {
  const out = new Map(a);
  for (const [key, value] of b) {
    const current = out.get(key);
    out.set(key, current === undefined ? value : join(current, value));
  }
  return out;
}
