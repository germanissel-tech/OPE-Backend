// Public API of the decision module (domain): the merchant's decision policy and its verdict
// (ADR-026), the session state the plane keeps, and the errors of a policy.
export { DecisionPolicy } from "./decision-policy.js";
export { DEFAULT_DECISION_POLICY, DEFAULT_POLICY_VERSION } from "./default-policy.js";
export { SessionState } from "./session-state.js";
export type { SessionStateRecord } from "./session-state.js";
export type {
  Abandonment,
  DecisionPolicyRecord,
  EvidenceRequirements,
  HighIntent,
  Trigger,
  TruthSummary,
  Verdict,
  VerdictInput,
} from "./decision-policy.js";
// The error classes stay inside the module: nobody outside builds or narrows on them (the
// configuration reads `code` and `details`); the union is the public shape.
export type { DecisionError } from "./errors.js";
