// `OPE_MERCHANTS[i].decisionPolicy` (ADR-026): the shape is parsed here; the rules — the closed
// vocabulary, the ranges, the permutation — belong to the domain (`BarrierRules.of`,
// `DecisionPolicy.of`, ADR-024). A domain rejection becomes a ConfigError naming the field, down
// to the condition inside a rule (`…rules[2].when.all[1].block`).
import {
  BarrierRules,
  type Condition,
  type EventRef,
  type Rule,
  type RuleStrength,
} from "../domain/barrier/index.js";
import { DecisionPolicy, type Abandonment, type HighIntent } from "../domain/decision/index.js";
import { ConfigError, type MerchantField } from "./config-error.js";
import type { Block, EventType } from "../domain/ingestion/index.js";
import type { Barrier, DomainError } from "../domain/shared-kernel/index.js";

const DEFAULT_READING_SECONDS = 5;
const DEFAULT_STRONG_WEIGHT = 0.4;
const DEFAULT_SUPPORTING_WEIGHT = 0.2;
const HIGH_INTENTS: readonly HighIntent[] = ["from-cart", "from-checkout", "never"];
const ABANDONMENTS: readonly Abandonment[] = ["nothing", "reassure-returns"];
const STRENGTHS: readonly RuleStrength[] = ["strong", "supporting"];
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

type Raw = Record<string, unknown>;

/** The keys the configuration may carry; typed so every occurrence is checked, never a loose string. */
type Key =
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
  | "availableVariant";

const at = (parent: MerchantField, key: Key): MerchantField => `${parent}.${key}`;
const get = (raw: Raw, key: Key): unknown => raw[key];

function record(value: unknown, where: MerchantField): Raw {
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

function oneOf<T extends string>(value: unknown, options: readonly T[], where: MerchantField): T {
  if (typeof value !== "string" || !(options as readonly string[]).includes(value)) {
    throw new ConfigError(where, `must be one of ${options.join(", ")}`);
  }
  return value as T;
}

function strings(value: unknown, where: MerchantField): string[] {
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
    throw new ConfigError(where, "must be an array of strings");
  }
  return value;
}

/** The value of a key and its location, so a key is written once per read. */
const num = (raw: Raw, key: Key, parent: MerchantField, fallback?: number): number =>
  number(get(raw, key) ?? fallback, at(parent, key));
const str = (raw: Raw, key: Key, parent: MerchantField): string => string(get(raw, key), at(parent, key));

function eventRef(value: unknown, parent: MerchantField): EventRef {
  const raw = record(value, parent);
  const type = str(raw, "type", parent) as EventType;
  return get(raw, "subtype") === undefined ? { type } : { type, subtype: str(raw, "subtype", parent) };
}

/** A condition: one of `all`, `any`, `not` or `fact`, recursively. The vocabulary is the domain's. */
function condition(value: unknown, parent: MerchantField): Condition {
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

function rule(value: unknown, parent: MerchantField): Rule {
  const raw = record(value, parent);
  const parsed: Rule = {
    id: str(raw, "id", parent),
    barrier: str(raw, "barrier", parent) as Barrier,
    strength: oneOf(get(raw, "strength"), STRENGTHS, at(parent, "strength")),
    when: condition(get(raw, "when"), at(parent, "when")),
  };
  return get(raw, "weight") === undefined ? parsed : { ...parsed, weight: num(raw, "weight", parent) };
}

function rules(value: unknown, parent: MerchantField): Rule[] {
  if (!Array.isArray(value)) throw new ConfigError(parent, "must be an array of rules");
  return value.map((item: unknown, i) => rule(item, `${parent}[${i}]`));
}

/** A domain rejection located at its field: `details.index` names the rule, `details.path` the field inside. */
function rejected(parent: MerchantField, error: DomainError): ConfigError {
  const { path, index } = error.details;
  const inside = typeof path === "string" ? path : "";
  const field: MerchantField =
    typeof index === "number" ? `${at(parent, "rules")}[${index}].${inside}` : `${parent}.${inside}`;
  return new ConfigError(field, `is invalid (${error.message})`);
}

/** The merchant's decision policy, or a ConfigError naming the field that cannot start the server. */
export function parseDecisionPolicy(value: unknown, parent: MerchantField): DecisionPolicy {
  const raw = record(value, parent);
  const weightsAt = at(parent, "weights");
  const weights = get(raw, "weights") === undefined ? {} : record(get(raw, "weights"), weightsAt);
  const evidenceAt = at(parent, "evidence");
  const evidence = record(get(raw, "evidence") ?? {}, evidenceAt);
  const barrierRules = BarrierRules.of({
    rules: rules(get(raw, "rules"), at(parent, "rules")),
    weights: {
      strong: num(weights, "strong", weightsAt, DEFAULT_STRONG_WEIGHT),
      supporting: num(weights, "supporting", weightsAt, DEFAULT_SUPPORTING_WEIGHT),
    },
    readingSeconds: num(raw, "readingSeconds", parent, DEFAULT_READING_SECONDS),
  });
  if (!barrierRules.ok) throw rejected(parent, barrierRules.error);
  const policy = DecisionPolicy.of({
    version: str(raw, "version", parent),
    rules: barrierRules.value,
    threshold: num(raw, "threshold", parent),
    priority: strings(get(raw, "priority"), at(parent, "priority")) as Barrier[],
    highIntent: oneOf(get(raw, "highIntent"), HIGH_INTENTS, at(parent, "highIntent")),
    abandonment: oneOf(get(raw, "abandonment"), ABANDONMENTS, at(parent, "abandonment")),
    interventionsPerSession: num(raw, "interventionsPerSession", parent),
    evidence: {
      freshStockAndPrice: strings(
        get(evidence, "freshStockAndPrice") ?? [],
        at(evidenceAt, "freshStockAndPrice"),
      ) as Barrier[],
      availableVariant: strings(
        get(evidence, "availableVariant") ?? [],
        at(evidenceAt, "availableVariant"),
      ) as Barrier[],
    },
  });
  if (!policy.ok) throw rejected(parent, policy.error);
  return policy.value;
}
