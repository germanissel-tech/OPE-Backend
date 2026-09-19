// `OPE_MERCHANTS[i].decisionPolicy` (ADR-026): the shape is parsed here; the rules — the closed
// vocabulary, the ranges, the permutation — belong to the domain (`BarrierRules.of`,
// `DecisionPolicy.of`, ADR-024). A domain rejection becomes a ConfigError naming the field, down
// to the condition inside a rule (`…rules[2].when.all[1].block`). What moved to the commercial
// policy (feature 012) is refused here, so nobody believes it still applies.
import { BarrierRules, type Rule, type RuleStrength } from "../domain/barrier/index.js";
import { DecisionPolicy } from "../domain/decision/index.js";
import {
  at,
  condition,
  get,
  num,
  oneOf,
  record,
  refuseMoved,
  rejected,
  str,
  strings,
  type Raw,
} from "./condition-config.js";
import { ConfigError, type MerchantField } from "./config-error.js";
import type { Barrier } from "../domain/shared-kernel/index.js";

const DEFAULT_READING_SECONDS = 5;
const DEFAULT_STRONG_WEIGHT = 0.4;
const DEFAULT_SUPPORTING_WEIGHT = 0.2;
const STRENGTHS: readonly RuleStrength[] = ["strong", "supporting"];
const MOVED_TO_COMMERCIAL = ["highIntent", "abandonment", "interventionsPerSession"] as const;

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

/** The merchant's decision policy, or a ConfigError naming the field that cannot start the server. */
export function parseDecisionPolicy(value: unknown, parent: MerchantField): DecisionPolicy {
  const raw: Raw = record(value, parent);
  refuseMoved(raw, MOVED_TO_COMMERCIAL, parent, "commercialPolicy");
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
  if (!barrierRules.ok) throw rejected(parent, barrierRules.error, "rules");
  const policy = DecisionPolicy.of({
    version: str(raw, "version", parent),
    rules: barrierRules.value,
    threshold: num(raw, "threshold", parent),
    priority: strings(get(raw, "priority"), at(parent, "priority")) as Barrier[],
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
