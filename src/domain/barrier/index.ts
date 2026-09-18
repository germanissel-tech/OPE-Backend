// Public API of the barrier module (domain): the closed vocabulary of signals, the condition
// algebra and the rule set that infers a barrier from them (ADR-026).
export { Signals } from "./signals.js";
export type { EventKey, EventRef } from "./signals.js";
export { FactContext } from "./condition.js";
export type {
  Condition,
  DwellSecondsCondition,
  EventCountCondition,
  FactCondition,
  FactContextInput,
  FlagCondition,
  ProductAttributeCondition,
  ProductFacts,
  SequenceCondition,
} from "./condition.js";
export { BarrierRules } from "./barrier-rules.js";
export type { BarrierRulesRecord, Inference, Rule, RuleStrength, RuleWeights } from "./barrier-rules.js";
export {
  BarrierWithoutRules,
  DuplicateRuleId,
  InvalidRuleThreshold,
  InvalidRuleWeight,
  UnknownBarrier,
  UnknownFact,
} from "./errors.js";
export type { BarrierError } from "./errors.js";
