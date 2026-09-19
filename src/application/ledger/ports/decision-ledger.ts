// Decision ledger port. `find` with another merchant returns undefined: nothing is revealed.
// `bySession` answers what the merchant's ledger knows of a session (the outcomes module
// correlates orders with it, ADR-028); another merchant's session is empty.
// `record` follows ADR-021: accepted into the write buffer, or LedgerUnavailable; never throws.
import type { Decision, LedgerUnavailable, DecisionId } from "../../../domain/ledger/index.js";
import type { MerchantId, Result, SessionId } from "../../../domain/shared-kernel/index.js";

export type RecordResult = Result<void, LedgerUnavailable>;

/** What the ledger knows of a session: the only question the correlation of an order asks (ADR-028). */
export interface SessionDecisions {
  /** The decisions of a session of the merchant, in the order they were recorded; empty if unknown. */
  bySession(merchantId: MerchantId, sessionId: SessionId): Promise<readonly Decision[]>;
}

export interface DecisionLedger extends SessionDecisions {
  record(decision: Decision): Promise<RecordResult>;
  find(merchantId: MerchantId, decisionId: DecisionId): Promise<Decision | undefined>;
}
