// The shape readers the policy parsers share (ADR-026, ADR-027): typed reads of the raw JSON of
// `OPE_MERCHANTS`, the recursive `condition()` of the closed fact algebra, and the translation
// of a domain rejection into a ConfigError that names the field. The vocabulary, the ranges and
// the permutations belong to the domain (`Vocabulary.captured`, `BarrierRules.of`,
// `DecisionPolicy.of`, `CommercialPolicy.of`, ADR-024); here only the shape is judged.
import { ConfigError, type MerchantField } from "./config-error.js";
import type { Condition, EventRef } from "../domain/barrier/index.js";
import type { Block, EventType } from "../domain/ingestion/index.js";
import type { DomainError } from "../domain/shared-kernel/index.js";

export type Raw = Record<string, unknown>;

/** The keys the policies may carry; typed so every occurrence is checked, never a loose string. */
export type Key =
  | "all"
  | "any"
  | "not"
  | "fact"
  | "type"
  | "subtype"
  | "min"
  | "block"
  | "first"
  | "then"
  | "key"
  | "value"
  | "id"
  | "barrier"
  | "strength"
  | "when"
  | "weight"
  | "weights"
  | "strong"
  | "supporting"
  | "readingSeconds"
  | "rules"
  | "version"
  | "threshold"
  | "priority"
  | "highIntent"
  | "abandonment"
  | "interventionsPerSession"
  | "evidence"
  | "freshStockAndPrice"
  | "availableVariant"
  | "maxIncentivePercent"
  | "incentiveLadderPercent"
  | "marginPercent"
  | "directIncentiveOnPrice"
  | "returnRisk"
  | "cooldownSeconds"
  | "interventionsPerVisitorPerDay"
  | "returnsPolicy"
  | "fitData"
  | "authorizedAttributes";

const FACTS = [
  "eventCount",
  "dwellSeconds",
  "sequence",
  "productAttribute",
  "returnedToProduct",
  "variantAvailable",
  "sessionAddedToCart",
  "sessionEnteredCheckout",
] as const;
type Fact = (typeof FACTS)[number];

export const at = (parent: MerchantField, key: Key): MerchantField => `${parent}.${key}`;
export const get = (raw: Raw, key: Key): unknown => raw[key];

export function record(value: unknown, where: MerchantField): Raw {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ConfigError(where, "is not an object");
  }
  return value as Raw;
}

function string(value: unknown, where: MerchantField): string {
  if (typeof value !== "string") throw new ConfigError(where, "must be a string");
  return value;
}

function number(value: unknown, where: MerchantField): number {
  if (typeof value !== "number") throw new ConfigError(where, "must be a number");
  return value;
}

function boolean(value: unknown, where: MerchantField): boolean {
  if (typeof value !== "boolean") throw new ConfigError(where, "must be a boolean");
  return value;
}

export function oneOf<T extends string>(value: unknown, options: readonly T[], where: MerchantField): T {
  if (typeof value !== "string" || !(options as readonly string[]).includes(value)) {
    throw new ConfigError(where, `must be one of ${options.join(", ")}`);
  }
  return value as T;
}

export function strings(value: unknown, where: MerchantField): string[] {
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
    throw new ConfigError(where, "must be an array of strings");
  }
  return value;
}

export function numbers(value: unknown, where: MerchantField): number[] {
  if (!Array.isArray(value) || !value.every((v) => typeof v === "number")) {
    throw new ConfigError(where, "must be an array of numbers");
  }
  return value;
}

/** The value of a key and its location, so a key is written once per read. */
export const num = (raw: Raw, key: Key, parent: MerchantField, fallback?: number): number =>
  number(get(raw, key) ?? fallback, at(parent, key));
export const str = (raw: Raw, key: Key, parent: MerchantField): string =>
  string(get(raw, key), at(parent, key));
export const bool = (raw: Raw, key: Key, parent: MerchantField, fallback?: boolean): boolean =>
  boolean(get(raw, key) ?? fallback, at(parent, key));

/** A key that moved to another policy: naming it where it no longer belongs stops the start. */
export function refuseMoved(raw: Raw, keys: readonly Key[], parent: MerchantField, movedTo: string): void {
  for (const key of keys) {
    if (get(raw, key) !== undefined) throw new ConfigError(at(parent, key), `moved to ${movedTo}`);
  }
}

function eventRef(value: unknown, parent: MerchantField): EventRef {
  const raw = record(value, parent);
  const type = str(raw, "type", parent) as EventType;
  return get(raw, "subtype") === undefined ? { type } : { type, subtype: str(raw, "subtype", parent) };
}

/** A condition: one of `all`, `any`, `not` or `fact`, recursively. The vocabulary is the domain's. */
export function condition(value: unknown, parent: MerchantField): Condition {
  const raw = record(value, parent);
  if (get(raw, "all") !== undefined) return { all: conditions(get(raw, "all"), at(parent, "all")) };
  if (get(raw, "any") !== undefined) return { any: conditions(get(raw, "any"), at(parent, "any")) };
  if (get(raw, "not") !== undefined) return { not: condition(get(raw, "not"), at(parent, "not")) };
  return fact(raw, oneOf(get(raw, "fact"), FACTS, at(parent, "fact")), parent);
}

function conditions(value: unknown, parent: MerchantField): Condition[] {
  if (!Array.isArray(value)) throw new ConfigError(parent, "must be an array of conditions");
  return value.map((item: unknown, i) => condition(item, `${parent}[${i}]`));
}

function fact(raw: Raw, kind: Fact, parent: MerchantField): Condition {
  switch (kind) {
    case "eventCount":
      return { fact: kind, ...eventRef(raw, parent), min: num(raw, "min", parent) };
    case "dwellSeconds": {
      const block = str(raw, "block", parent) as Block;
      return get(raw, "min") === undefined
        ? { fact: kind, block }
        : { fact: kind, block, min: num(raw, "min", parent) };
    }
    case "sequence":
      return {
        fact: kind,
        first: eventRef(get(raw, "first"), at(parent, "first")),
        then: eventRef(get(raw, "then"), at(parent, "then")),
      };
    case "productAttribute":
      return { fact: kind, key: str(raw, "key", parent), value: str(raw, "value", parent) };
    case "returnedToProduct":
    case "variantAvailable":
    case "sessionAddedToCart":
    case "sessionEnteredCheckout":
      return { fact: kind };
  }
}

/**
 * A domain rejection located at its field: `details.path` names the field and `details.index`
 * the element — of the list `indexed` when the path is inside its elements (`rules[2].when…`),
 * of the field itself otherwise (`incentiveLadderPercent[1]`).
 */
export function rejected(parent: MerchantField, error: DomainError, indexed?: Key): ConfigError {
  const { path, index } = error.details;
  const inside = typeof path === "string" ? path : "";
  let field: MerchantField = `${parent}.${inside}`;
  if (typeof index === "number") {
    field = indexed === undefined ? `${field}[${index}]` : `${at(parent, indexed)}[${index}].${inside}`;
  }
  return new ConfigError(field, `is invalid (${error.message})`);
}
