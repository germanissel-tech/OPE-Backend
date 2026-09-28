// Decision ledger port. `find` with another merchant returns undefined: nothing is revealed.
// `bySession` answers what the merchant's ledger knows of a session (the outcomes module
// correlates orders with it, ADR-028); another merchant's session is empty.
// `record` follows ADR-021: accepted into the write buffer, or LedgerUnavailable; never throws.
import type { Decision, LedgerUnavailable, DecisionId } from "../../../domain/ledger/index.js";
import type { MerchantId, Result, SessionId, VisitorId } from "../../../domain/shared-kernel/index.js";

export type RecordResult = Result<void, LedgerUnavailable>;

/** What the ledger knows of a session: the only question the correlation of an order asks (ADR-028). */
export interface SessionDecisions {
  /** The decisions of a session of the merchant, in the order they were recorded; empty if unknown. */
  bySession(merchantId: MerchantId, sessionId: SessionId): Promise<readonly Decision[]>;
}

/** What the ledger knows of a visitor: the question the fatigue limit asks (feature 032, FR-007). */
export interface VisitorDecisions {
  /**
   * The decisions of a visitor of the merchant since an instant, oldest first (feature 032, FR-007).
   * What it is for is the fatigue limit, which counts the interventions a visitor received across
   * their sessions — a count that until now existed only in memory, so a restart handed every visitor
   * their whole quota back.
   *
   * **`since` bounds the work, it does not decide the rule.** The answer may carry a few decisions
   * older than the window, because a durable store can only range over an instant it has indexed and
   * the one the domain means travels inside the record. It can never carry *fewer*: a row is written
   * after the decision it records. The exact cut stays where it already was, in
   * `VisitorState.countSince`.
   *
   * Every outcome, not only the interventions: which decisions count is `decision.isIntervention()`,
   * a rule of the domain, and a store that filtered by it would be that rule written a second time.
   */
  byVisitor(merchantId: MerchantId, visitorId: VisitorId, since: Date): Promise<readonly Decision[]>;
}

/**
 * The two reads a forgotten state is rebuilt from (feature 032): what the session already received and
 * what the visitor did. Named as one thing because it is one job — whoever rebuilds asks both and
 * writes neither, so depending on the whole ledger would hand it a `record` it must not call.
 */
export interface PastDecisions extends SessionDecisions, VisitorDecisions {}

export interface DecisionLedger extends SessionDecisions, VisitorDecisions {
  record(decision: Decision): Promise<RecordResult>;
  find(merchantId: MerchantId, decisionId: DecisionId): Promise<Decision | undefined>;
}
