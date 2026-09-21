// Public API of the commercial module (domain): the merchant's commercial policy and its
// verdict — the last authority of the decision plane (ADR-027).
export { CommercialPolicy } from "./commercial-policy.js";
export type {
  Abandonment,
  Blocked,
  BlockReason,
  CommercialInput,
  CommercialPolicyRecord,
  CommercialVerdict,
  HighIntent,
  Trigger,
} from "./commercial-policy.js";
// The error classes stay inside the module: the configuration reads `code` and `details`.
export type { CommercialError } from "./errors.js";
