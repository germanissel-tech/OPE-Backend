// barrier module (ADR-026): the inference authority. Serves no operation: the decision module
// asks it for the confidence of every barrier. Rule-based today; another implementation of the
// port (a model trained offline) would be one more binding here.
import { RuleBasedBarrierInference, type BarrierInference } from "../../application/barrier/index.js";
import type { Bindings, Module } from "../wiring.js";

export interface BarrierPorts {
  inference: BarrierInference;
}

export const ruleBarrierPorts: Bindings<BarrierPorts> = {
  inference: () => new RuleBasedBarrierInference(),
};

export const barrierModule: Module<BarrierPorts> = () => ({});
