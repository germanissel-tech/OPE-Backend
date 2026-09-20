// The admin log (ADR-031): what an operator did or tried, one entry per action. Never a
// credential, never a personal datum: the actor is an operator identifier.
import type { OperatorId } from "./ids.js";
import type { ExperimentId, MerchantId } from "../shared-kernel/index.js";

/** Accepted by the use case, rejected by a business rule (with its code), or denied by scope. */
export type AdminOutcome = "accepted" | "rejected" | "denied";

/** What an action produced, when it produced something. */
export interface AdminResult {
  configurationVersion?: number | undefined;
  experimentId?: ExperimentId | undefined;
  windowRestarted?: boolean | undefined;
}

export interface AdminEntry {
  at: Date;
  operatorId: OperatorId;
  /** The `operationId` of the contract, or the name of the system action (the import). */
  operation: string;
  merchantId?: MerchantId | undefined;
  outcome: AdminOutcome;
  /** The slug of the error when rejected or denied. */
  code?: string | undefined;
  result?: AdminResult | undefined;
  /** The reason the operator declared (a corrective configuration version). */
  reason?: string | undefined;
}
