// What every operation an operator performs leaves written (constitution IX; ADR-034). It lives in
// the kernel because traceability is an obligation of the platform, like the log: any module may
// have to write it, and no module should have to depend on the administration to do so.
//
// The actor travels as text: who owns that identity is the operator module, which the kernel
// cannot see. The administration types it again when it stores the entry, and that is the only
// place where the loss is repaired (ADR-034).
import type { ExperimentId, MerchantId } from "./ids.js";

/** Accepted by the use case, rejected by a business rule (with its code), or denied by scope. */
export type AuditOutcome = "accepted" | "rejected" | "denied";

/** What an action produced, when it produced something. */
export interface AuditResult {
  configurationVersion?: number | undefined;
  experimentId?: ExperimentId | undefined;
  windowRestarted?: boolean | undefined;
}

export interface AuditEntry {
  at: Date;
  /** The operator, as text: the kernel does not know the identity it belongs to. */
  operatorId: string;
  /** The `operationId` of the contract, or the name of the system action (the import). */
  operation: string;
  merchantId?: MerchantId | undefined;
  outcome: AuditOutcome;
  /** The slug of the error when rejected or denied. */
  code?: string | undefined;
  result?: AuditResult | undefined;
  /** The reason the operator declared (a corrective configuration version). */
  reason?: string | undefined;
}
