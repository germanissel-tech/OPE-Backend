// The rule-based barrier inference (ADR-026): the merchant's rules evaluated by the domain.
// Stateless and pure by construction; the Promise is the port's shape, not I/O.
import type { Inference } from "../../../domain/barrier/index.js";
import type { BarrierInference, InferenceContext } from "../ports/barrier-inference.js";

export class RuleBasedBarrierInference implements BarrierInference {
  infer({ rules, signals, product }: InferenceContext): Promise<Inference> {
    return Promise.resolve(rules.infer(signals, product));
  }
}
