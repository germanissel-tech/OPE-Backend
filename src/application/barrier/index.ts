// Public API of the barrier module (application): the inference port and its rule-based
// implementation (ADR-026).
export type { BarrierInference, InferenceContext } from "./ports/barrier-inference.js";
export { RuleBasedBarrierInference } from "./services/rule-based-inference.service.js";
