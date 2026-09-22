// barrier module (ADR-026): the inference authority. It serves no operation — the decision plane
// asks it for the confidence of every barrier — and is rule-based today; a model trained offline
// would be one more technology here, with no consumer changing.
import { RuleBasedBarrierInference, type BarrierInference } from "../../application/barrier/index.js";
import { bind, compositionModule, port, technology } from "../graph/index.js";

export const BarrierInferencePort = port("barrier.inference")<BarrierInference>();

const PORTS = [BarrierInferencePort] as const;

export const barrierModule = compositionModule({
  ports: PORTS,
  technologies: {
    rules: technology(PORTS, [bind(BarrierInferencePort, {}, () => new RuleBasedBarrierInference())]),
  },
});
