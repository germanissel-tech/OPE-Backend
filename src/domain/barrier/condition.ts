// Conditions of a barrier rule (ADR-026): a closed algebra over the facts OPE captures. A
// merchant combines facts with `all`, `any` and `not`; it cannot name a fact outside this
// vocabulary (BarrierRules.of rejects it). Conditions are data — what the configuration
// declares — and FactContext is the value that knows whether one holds.
import type { Signals, EventRef } from "./signals.js";
import type { Block, EventType } from "../ingestion/index.js";

export interface EventCountCondition {
  fact: "eventCount";
  type: EventType;
  subtype?: string;
  min: number;
}
export interface DwellSecondsCondition {
  fact: "dwellSeconds";
  block: Block;
  /** Absent: the reading seconds of the policy. */
  min?: number;
}
export interface SequenceCondition {
  fact: "sequence";
  first: EventRef;
  then: EventRef;
}
export interface ProductAttributeCondition {
  fact: "productAttribute";
  key: string;
  value: string;
}
export interface FlagCondition {
  fact: "returnedToProduct" | "variantAvailable" | "sessionAddedToCart" | "sessionEnteredCheckout";
}

export type FactCondition =
  EventCountCondition | DwellSecondsCondition | SequenceCondition | ProductAttributeCondition | FlagCondition;

export type Condition =
  { all: readonly Condition[] } | { any: readonly Condition[] } | { not: Condition } | FactCondition;

/** What the product truth says, for the product predicates; `available` is absent without a variant in focus. */
export interface ProductFacts {
  attributes: ReadonlyMap<string, string>;
  available?: boolean;
}

export interface FactContextInput {
  signals: Signals;
  product: ProductFacts;
  /** The dwell a `dwellSeconds` predicate without `min` asks for. */
  readingSeconds: number;
}

const ADDED_TO_CART: EventRef = { type: "added_to_cart" };
const CHECKOUT_ADVANCED: EventRef = { type: "checkout_advanced" };
const RETURNED_TO_PRODUCT: EventRef = { type: "product_returned_to" };

/** The facts a condition is judged against: the session's signals and the product truth. */
export class FactContext {
  readonly #signals: Signals;
  readonly #product: ProductFacts;
  readonly #readingSeconds: number;

  private constructor(input: FactContextInput) {
    this.#signals = input.signals;
    this.#product = input.product;
    this.#readingSeconds = input.readingSeconds;
  }

  static of(input: FactContextInput): FactContext {
    return new FactContext(input);
  }

  /** `all([])` holds, `any([])` does not: the identities of the algebra. */
  holds(condition: Condition): boolean {
    if ("all" in condition) return condition.all.every((c) => this.holds(c));
    if ("any" in condition) return condition.any.some((c) => this.holds(c));
    if ("not" in condition) return !this.holds(condition.not);
    return this.#fact(condition);
  }

  #fact(condition: FactCondition): boolean {
    switch (condition.fact) {
      case "eventCount":
        return this.#signals.count(condition) >= condition.min;
      case "dwellSeconds":
        return this.#signals.dwellSeconds(condition.block) >= (condition.min ?? this.#readingSeconds);
      case "sequence":
        return this.#signals.sequence(condition.first, condition.then);
      case "productAttribute":
        return this.#product.attributes.get(condition.key) === condition.value;
      case "returnedToProduct":
        return this.#signals.count(RETURNED_TO_PRODUCT) >= 1;
      case "variantAvailable":
        return this.#product.available === true;
      case "sessionAddedToCart":
        return this.#signals.count(ADDED_TO_CART) >= 1;
      case "sessionEnteredCheckout":
        return this.#signals.count(CHECKOUT_ADVANCED) >= 1;
    }
  }
}
