// The recursive reading of a condition (ADR-026): one of `all`, `any`, `not` or a fact of the
// closed algebra. The vocabulary of events, subtypes and blocks is the domain's
// (`Vocabulary.captured`, judged by `BarrierRules.of`); here only the shape.
import { at, type Field, type Key, type Raw, type Shape } from "./shape.js";
import type { Condition, EventRef, FactCondition } from "../../../domain/barrier/index.js";
import type { Block, EventType } from "../../../domain/ingestion/index.js";

/**
 * The facts the configuration admits: the domain's vocabulary, complete by construction (015
 * F-039) — `satisfies` checks each entry is a fact, and tests/types/condition-config.test-d.ts
 * checks no fact of the domain is missing.
 */
const FACTS = [
  "eventCount",
  "dwellSeconds",
  "sequence",
  "productAttribute",
  "returnedToProduct",
  "variantAvailable",
  "sessionAddedToCart",
  "sessionEnteredCheckout",
] as const satisfies readonly FactCondition["fact"][];
type Fact = (typeof FACTS)[number];

export type ConfiguredFact = Fact;

const EVENT_REF_KEYS: readonly Key[] = ["type", "subtype"];
const NOT: Key = "not";
const FACT_KEYS: Readonly<Record<Fact, readonly Key[]>> = {
  eventCount: ["fact", "type", "subtype", "min"],
  dwellSeconds: ["fact", "block", "min"],
  sequence: ["fact", "first", "then"],
  productAttribute: ["fact", "key", "value"],
  returnedToProduct: ["fact"],
  variantAvailable: ["fact"],
  sessionAddedToCart: ["fact"],
  sessionEnteredCheckout: ["fact"],
};

/** The type and optional subtype of a record that names an event (a fact of `eventCount`, or a reference). */
function eventOf(shape: Shape, raw: Raw, where: Field): EventRef {
  const type = shape.string(raw, "type", where) as EventType;
  return shape.has(raw, "subtype") ? { type, subtype: shape.string(raw, "subtype", where) } : { type };
}

function eventRef(shape: Shape, raw: Raw, key: Key, where: Field): EventRef {
  const ref = shape.recordAt(raw, key, where);
  shape.closed(ref, EVENT_REF_KEYS, at(where, key));
  return eventOf(shape, ref, at(where, key));
}

function fact(shape: Shape, raw: Raw, kind: Fact, where: Field): Condition {
  shape.closed(raw, FACT_KEYS[kind], where);
  switch (kind) {
    case "eventCount":
      return { fact: kind, ...eventOf(shape, raw, where), min: shape.number(raw, "min", where) };
    case "dwellSeconds": {
      const block = shape.string(raw, "block", where) as Block;
      return shape.has(raw, "min")
        ? { fact: kind, block, min: shape.number(raw, "min", where) }
        : { fact: kind, block };
    }
    case "sequence":
      return {
        fact: kind,
        first: eventRef(shape, raw, "first", where),
        then: eventRef(shape, raw, "then", where),
      };
    case "productAttribute":
      return { fact: kind, key: shape.string(raw, "key", where), value: shape.string(raw, "value", where) };
    case "returnedToProduct":
    case "variantAvailable":
    case "sessionAddedToCart":
    case "sessionEnteredCheckout":
      return { fact: kind };
  }
}

/** A combinator over conditions, read recursively. */
function combined(shape: Shape, raw: Raw, key: "all" | "any", where: Field): Condition[] {
  shape.closed(raw, [key], where);
  return shape.list(raw, key, where, (item, w) => condition(shape, item, w));
}

/** A condition: one of `all`, `any`, `not` or `fact`, recursively. */
export function condition(shape: Shape, value: unknown, where: Field): Condition {
  const raw = shape.record(value, where);
  if (shape.has(raw, "all")) return { all: combined(shape, raw, "all", where) };
  if (shape.has(raw, "any")) return { any: combined(shape, raw, "any", where) };
  if (shape.has(raw, NOT)) {
    shape.closed(raw, [NOT], where);
    return { not: condition(shape, shape.get(raw, NOT), at(where, NOT)) };
  }
  return fact(shape, raw, shape.oneOf(raw, "fact", FACTS, where), where);
}
