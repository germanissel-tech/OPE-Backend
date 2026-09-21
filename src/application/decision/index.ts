// Public API of the decision module (application): the orchestrator of the decision plane and
// its ports (ADR-026); the windows it applies are the platform's (constitution XI).
export type { MerchantPolicies, PolicyDirectory, PolicySet, PolicySource } from "./ports/policy-directory.js";
export type { SessionStateStore, SessionWindow } from "./ports/session-state-store.js";
export type { VisitorStateStore, VisitorWindow } from "./ports/visitor-state-store.js";
export { DefaultStateService } from "./services/state.service.js";
export type {
  Remembered,
  StateService,
  StateServiceDependencies,
  ToRemember,
  Whose,
} from "./services/state.service.js";
export { DecisionService } from "./services/decision.service.js";
export type { DecisionServiceDependencies } from "./services/decision.service.js";
