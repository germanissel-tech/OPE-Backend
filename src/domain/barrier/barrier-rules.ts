// Barrier rules (01-arquitectura-mvp.md §4.2; ADR-026): the inference authority of the MVP as a
// merchant declares it. Each rule says "when <condition> then <barrier>, with a strength"; the
// confidence of a barrier is the capped sum of the weights of its rules that hold. A rule set
// only exists valid: `of` checks every reference against the closed vocabulary, so a policy that
// names a fact OPE does not capture never runs. `infer` is pure: same signals and facts, same
// inference, on any instance.
import { BARRIERS, fail, ok, type Barrier, type Result } from "../shared-kernel/index.js";
import { FactContext, Vocabulary, type Condition, type ProductFacts } from "./condition.js";
import {
  BarrierWithoutRules,
  DuplicateRuleId,
  InvalidRuleThreshold,
  InvalidRuleWeight,
  UnknownBarrier,
  type BarrierError,
} from "./errors.js";
import type { Signals } from "./signals.js";

export type RuleStrength = "strong" | "supporting";

export interface Rule {
  /** Unique within the policy; the ledger records the ids of the rules that held. */
  id: string;
  when: Condition;
  barrier: Barrier;
  strength: RuleStrength;
  /** Overrides the weight of its strength; 0..1. */
  weight?: number;
}

export interface RuleWeights {
  strong: number;
  supporting: number;
}

export interface BarrierRulesRecord {
  rules: readonly Rule[];
  weights: RuleWeights;
  /** The dwell a `dwellSeconds` predicate without `min` asks for. */
  readingSeconds: number;
}

/** What the authority answers: a confidence per barrier and the rules that held. */
export interface Inference {
  confidences: Readonly<Record<Barrier, number>>;
  matched: readonly string[];
}

/** Confidences are rounded so that sums of weights compare exactly against a threshold. */
const CONFIDENCE_PRECISION = 10_000;

const isShare = (value: number): boolean => Number.isFinite(value) && value >= 0 && value <= 1;
const isCount = (value: number): boolean => Number.isFinite(value) && value >= 0;

export class BarrierRules {
  readonly rules: readonly Rule[];
  readonly weights: RuleWeights;
  readonly readingSeconds: number;

  private constructor(record: BarrierRulesRecord) {
    this.rules = record.rules;
    this.weights = record.weights;
    this.readingSeconds = record.readingSeconds;
  }

  /**
   * The rule set of a merchant, or the first violated invariant: weights and thresholds in
   * range, ids unique, barriers of the MVP, every referenced fact in the vocabulary, and at
   * least one rule per barrier. `details.index` names the offending rule, `details.path` the
   * field inside it.
   */
  static of(record: BarrierRulesRecord): Result<BarrierRules, BarrierError> {
    if (!isShare(record.weights.strong)) return fail(new InvalidRuleWeight("weights.strong"));
    if (!isShare(record.weights.supporting)) return fail(new InvalidRuleWeight("weights.supporting"));
    if (!isCount(record.readingSeconds)) return fail(new InvalidRuleThreshold("readingSeconds"));
    const ids = new Set<string>();
    for (const [index, rule] of record.rules.entries()) {
      if (rule.id === "" || ids.has(rule.id)) return fail(new DuplicateRuleId(rule.id, index));
      ids.add(rule.id);
      const invalid = checkRule(rule, index);
      if (invalid) return fail(invalid);
    }
    const missing = BARRIERS.find((barrier) => !record.rules.some((r) => r.barrier === barrier));
    if (missing !== undefined) return fail(new BarrierWithoutRules(missing));
    return ok(new BarrierRules({ ...record, rules: [...record.rules] }));
  }

  /** A rule set a store recorded: its invariants are not re-judged. */
  static rehydrate(record: BarrierRulesRecord): BarrierRules {
    return new BarrierRules(record);
  }

  weightOf(rule: Rule): number {
    return rule.weight ?? this.weights[rule.strength];
  }

  /** The confidence of every barrier over these facts, and the rules that held, in declaration order. */
  infer(signals: Signals, product: ProductFacts): Inference {
    const context = FactContext.of({ signals, product, readingSeconds: this.readingSeconds });
    const sums: Record<Barrier, number> = { fit: 0, price: 0, returns: 0 };
    const matched: string[] = [];
    for (const rule of this.rules) {
      if (!context.holds(rule.when)) continue;
      matched.push(rule.id);
      sums[rule.barrier] += this.weightOf(rule);
    }
    const confidences = { fit: cap(sums.fit), price: cap(sums.price), returns: cap(sums.returns) };
    return { confidences, matched };
  }
}

function cap(sum: number): number {
  return Math.min(1, Math.round(sum * CONFIDENCE_PRECISION) / CONFIDENCE_PRECISION);
}

function checkRule(rule: Rule, index: number): BarrierError | undefined {
  if (!(BARRIERS as readonly string[]).includes(rule.barrier)) return new UnknownBarrier(rule.barrier, index);
  if (rule.weight !== undefined && !isShare(rule.weight)) return new InvalidRuleWeight("weight", index);
  return Vocabulary.captured.check(rule.when, "when", index);
}
