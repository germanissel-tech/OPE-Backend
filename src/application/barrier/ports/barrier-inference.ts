// Barrier inference port (01-arquitectura-mvp.md §4.2; ADR-026): the inference authority as the
// orchestrator sees it. Input: the merchant's rules, the session's signals and the product
// facts; output: a confidence per barrier and the rules that held. Rule-based today; another
// implementation (a model trained offline, constitution VIII) would bind here.
import type { BarrierRules, Inference, ProductFacts, Signals } from "../../../domain/barrier/index.js";

export interface InferenceContext {
  rules: BarrierRules;
  signals: Signals;
  product: ProductFacts;
}

export interface BarrierInference {
  infer(context: InferenceContext): Promise<Inference>;
}
