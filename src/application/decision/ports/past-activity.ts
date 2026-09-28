// What the reconstruction reads of what is durable (feature 032), and **the port that makes the
// asymmetry of Q1 expressible**. Three reads, each with a failure channel, because the answer to a
// failure is not the same for all three:
//
//   - the **interventions** of the session and of the visitor protect the guarantee this feature adds.
//     Nothing can stand in for them, so a failure has to degrade the decision (FR-013).
//   - the **signals** improve the quality of the decision. When they cannot be read the session still
//     absorbs the ones of the current batch, which is what the system does in every session today, so
//     degrading would buy no correctness and would cost interventions that are being emitted now
//     (FR-015).
//
// **Why a port of this module and not the register and the ledger directly.** Those two read ports
// throw, like every durable read outside this feature, and the application ring may not catch
// (`ope/no-generic-catch-in-application`): a `catch` there could only swallow a programming error. So
// the translation from a throw to a value belongs to an adapter, and what the service depends on is
// this — three reads that answer, and never throw for a reason the plane has to act on.
//
// It is the same point of the `persistence-and-resilience` milestone the two state stores brought
// forward, arriving where it is needed rather than everywhere at once.
//
// **What "could not answer" does not include today, and why that is not an omission.** FR-016 asks for a
// deadline — a read that takes too long counts as unanswered — and there is none, because against this
// store the case cannot arise: `SqlStore` is **synchronous**, and a synchronous read either returns or
// throws. There is no state in between for a timer to catch, and a deadline over it would be a
// configuration entry that no input could ever reach, which is worse than none: it would read as a
// guarantee.
//
// The half of FR-016 that can happen — the store refusing or failing — is what this port covers. The
// deadline belongs to the first gateway whose reads are actually remote, which is the PostgreSQL one
// (**D-21**, research R-03), and it arrives with that gateway together with the evidence to choose its
// value. Writing the entry now would fix a number nobody has measured against a store nobody has.
import type { StateUnavailable } from "../../../domain/decision/index.js";
import type { RecordedEvent } from "../../../domain/ingestion/index.js";
import type { Decision } from "../../../domain/ledger/index.js";
import type { MerchantId, Result, SessionId, VisitorId } from "../../../domain/shared-kernel/index.js";

/** What a read of the durable side answered, or that it could not be determined. */
export type Read<T> = Result<T, StateUnavailable>;

export interface PastActivity {
  /**
   * Everything the register has for a session, in arrival order. Which of those arrivals the plane
   * absorbed is not decided here: that is one rule in one place, and it lives with whoever replays it.
   */
  arrivalsOf(merchantId: MerchantId, sessionId: SessionId): Promise<Read<readonly RecordedEvent[]>>;

  /** Every decision of the session, in the order recorded. Which ones are interventions is a rule of the domain. */
  decisionsOf(merchantId: MerchantId, sessionId: SessionId): Promise<Read<readonly Decision[]>>;

  /**
   * Every decision of the visitor since an instant. `since` bounds the work and not the rule: the
   * answer may carry a few older ones, never fewer, and the exact cut is `VisitorState.countSince`.
   */
  decisionsOfVisitor(
    merchantId: MerchantId,
    visitorId: VisitorId,
    since: Date,
  ): Promise<Read<readonly Decision[]>>;
}
