// Public API of the decision module (domain): the merchant's decision policy and its barrier
// verdict (ADR-026), the session and visitor state the plane keeps, and the errors of a policy.
export { DecisionPolicy } from "./decision-policy.js";
export { DEFAULT_DECISION_POLICY, DEFAULT_POLICY_VERSION } from "./default-policy.js";
export { SessionState } from "./session-state.js";
export { VisitorState } from "./visitor-state.js";
export type { VisitorStateRecord } from "./visitor-state.js";
export type { SessionStateRecord } from "./session-state.js";
export type {
  BarrierVerdict,
  BarrierVerdictInput,
  DecisionPolicyRecord,
  EvidenceRequirements,
  TruthSummary,
} from "./decision-policy.js";
// The error classes stay inside the module: nobody outside builds or narrows on them (the
// configuration reads `code` and `details`); the union is the public shape.
export type { DecisionError } from "./errors.js";
