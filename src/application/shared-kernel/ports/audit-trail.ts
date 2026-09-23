// Audit trail port (ADR-034): where the record of what an operator did is written. Narrow on
// purpose — only the write — so that a module which audits does not depend on the module that
// owns the log, its storage and its paginated reads. Writes return a Result: a log that cannot
// be written is a fact, not an exception (ADR-021).
import type { AuditEntry, Result, StoreUnavailable } from "../../../domain/shared-kernel/index.js";

export interface AuditTrail {
  record(entry: AuditEntry): Promise<Result<undefined, StoreUnavailable>>;
  /**
   * Whether the trail can be written to right now. An administration action that cannot be
   * audited does not happen (ADR-034, amended 2026-09-23), and the only honest moment to
   * find out is **before** it runs: answering afterwards would tell the operator that something
   * did not happen when it did.
   */
  writable(): Promise<Result<undefined, StoreUnavailable>>;
}
