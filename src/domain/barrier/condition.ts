// Conditions of a barrier rule (ADR-026): a closed algebra over the facts OPE captures. A
// merchant combines facts with `all`, `any` and `not`; it cannot name a fact outside this
// vocabulary (BarrierRules.of rejects it). Conditions are data — what the configuration
// declares — and FactContext is the value that knows whether one holds.
import { BLOCKS, EVENT_TYPES, SUBTYPES, type Block, type EventType } from "../ingestion/index.js";
import { isCount } from "../shared-kernel/index.js";
import { InvalidRuleThreshold, UnknownFact } from "./errors.js";
import type { EventRef, Signals } from "./signals.js";

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

/** The combinators of the algebra, named once: `in` narrows on a literal type all the same. */
const ALL = "all" as const;
const ANY = "any" as const;
const NOT = "not" as const;

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
    if (ALL in condition) return condition.all.every((c) => this.holds(c));
    if (ANY in condition) return condition.any.some((c) => this.holds(c));
    if (NOT in condition) return !this.holds(condition.not);
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

/** What a condition may violate: a reference outside the vocabulary or a threshold out of range. */
export type ConditionError = UnknownFact | InvalidRuleThreshold;

/**
 * The vocabulary check of a condition (ADR-026): every event type, subtype and block it names
 * exists, every threshold is a non-negative number. Shared by whoever declares conditions —
 * the barrier rules and the commercial policy — so no policy runs with a fact OPE does not
 * capture. `path` locates the offence (`when.all[1].block`); `index` names the rule, if any.
 */
export class Vocabulary {
  /** The facts OPE captures today: the only vocabulary a condition may name. */
  static readonly captured = new Vocabulary(EVENT_TYPES, SUBTYPES, BLOCKS);

  readonly #types: readonly string[];
  readonly #subtypes: Readonly<Partial<Record<EventType, readonly string[]>>>;
  readonly #blocks: readonly string[];

  private constructor(
    types: readonly string[],
    subtypes: Readonly<Partial<Record<EventType, readonly string[]>>>,
    blocks: readonly string[],
  ) {
    this.#types = types;
    this.#subtypes = subtypes;
    this.#blocks = blocks;
  }

  check(condition: Condition, path: string, index?: number): ConditionError | undefined {
    if (ALL in condition) return this.#list(condition.all, `${path}.${ALL}`, index);
    if (ANY in condition) return this.#list(condition.any, `${path}.${ANY}`, index);
    if (NOT in condition) return this.check(condition.not, `${path}.${NOT}`, index);
    return this.#fact(condition, path, index);
  }

  #list(conditions: readonly Condition[], path: string, index?: number): ConditionError | undefined {
    for (const [i, condition] of conditions.entries()) {
      const invalid = this.check(condition, `${path}[${i}]`, index);
      if (invalid) return invalid;
    }
    return undefined;
  }

  #fact(condition: FactCondition, path: string, index?: number): ConditionError | undefined {
    switch (condition.fact) {
      case "eventCount":
        return (
          this.#ref(condition, path, index) ??
          (isCount(condition.min) ? undefined : new InvalidRuleThreshold(`${path}.min`, index))
        );
      case "dwellSeconds":
        if (!this.#blocks.includes(condition.block)) {
          return new UnknownFact(`${path}.block`, condition.block, index);
        }
        return condition.min === undefined || isCount(condition.min)
          ? undefined
          : new InvalidRuleThreshold(`${path}.min`, index);
      case "sequence":
        return (
          this.#ref(condition.first, `${path}.first`, index) ??
          this.#ref(condition.then, `${path}.then`, index)
        );
      case "productAttribute":
      case "returnedToProduct":
      case "variantAvailable":
      case "sessionAddedToCart":
      // Stryker disable next-line ConditionalExpression: emptied, the last case falls through to the end of the switch and yields undefined all the same
      case "sessionEnteredCheckout":
        return undefined;
    }
  }

  #ref(ref: EventRef, path: string, index?: number): ConditionError | undefined {
    if (!this.#types.includes(ref.type)) {
      return new UnknownFact(`${path}.type`, ref.type, index);
    }
    if (ref.subtype === undefined) return undefined;
    const subtypes = this.#subtypes[ref.type];
    return subtypes?.includes(ref.subtype)
      ? undefined
      : new UnknownFact(`${path}.subtype`, ref.subtype, index);
  }
}
