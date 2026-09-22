// The admin log (ADR-031, ADR-034): what an operator did or tried, one entry per action. Never a
// credential, never a personal datum: the actor is an operator identifier. It is the kernel's
// audit entry with its actor typed again: what is written comes in as text (any module may write
// it) and is stored as the identity it belongs to.
import type { OperatorId } from "../operator/index.js";
import type { AuditEntry, AuditOutcome, AuditResult } from "../shared-kernel/index.js";

/** Accepted by the use case, rejected by a business rule (with its code), or denied by scope. */
export type AdminOutcome = AuditOutcome;

/** What an action produced, when it produced something. */
export type AdminResult = AuditResult;

export interface AdminEntry extends Omit<AuditEntry, "operatorId"> {
  operatorId: OperatorId;
}
