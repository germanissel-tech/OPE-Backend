// Audit trail port (ADR-034): where the record of what an operator did is written. Narrow on
// purpose — only the write — so that a module which audits does not depend on the module that
// owns the log, its storage and its paginated reads. Writes return a Result: a log that cannot
// be written is a fact, not an exception (ADR-021).
import type { AuditEntry, Result, StoreUnavailable } from "../../../domain/shared-kernel/index.js";

export interface AuditTrail {
  record(entry: AuditEntry): Promise<Result<undefined, StoreUnavailable>>;
}
