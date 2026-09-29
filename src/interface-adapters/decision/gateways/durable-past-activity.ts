// The three durable reads of the reconstruction, as values instead of exceptions (feature 032).
//
// This gateway exists for one reason and it is worth stating plainly: the register and the ledger
// **throw** when their store cannot answer — that is how every durable read outside this feature
// behaves — and the application ring may not catch, because a `catch` there could only swallow a
// programming error and turn it into a silently wrong decision
// (`ope/no-generic-catch-in-application`, ADR-023). So the translation happens here, in the ring whose
// job is translating, and the service above depends on three reads that answer.
//
// **What it does not do is decide what a failure means.** It reports one; whether that degrades the
// decision or merely makes it poorer is the asymmetry of Q1 and belongs to the plane (FR-013, FR-015).
// A gateway that degraded on its own would put a policy in the one place that has no business holding
// one.
import { StateUnavailable } from "../../../domain/decision/index.js";
import { fail, ok } from "../../../domain/shared-kernel/index.js";
import type { PastActivity, Read } from "../../../application/decision/index.js";
import type { SessionEvents } from "../../../application/ingestion/index.js";
import type { PastDecisions } from "../../../application/ledger/index.js";
import type { Logger } from "../../../application/shared-kernel/index.js";

export interface DurablePastActivityDeps {
  /** The register of what arrived: where the signals of a forgotten session come from. */
  events: SessionEvents;
  /** The ledger: where the interventions of a session and of a visitor come from. */
  decisions: PastDecisions;
  logger: Logger;
}

/**
 * What the store threw, as the value the port promises. The error is **logged here and not carried**:
 * `StateUnavailable` travels to the plane to be acted on, and what actually went wrong is operational
 * detail the plane cannot use and must not put in a decision.
 *
 * `what` names the side that failed, which is what tells FR-013 from FR-015 when reading the log.
 */
async function read<T>(
  attempt: () => Promise<T>,
  what: "session" | "visitor",
  which: string,
  logger: Logger,
): Promise<Read<T>> {
  try {
    return ok(await attempt());
  } catch (err) {
    logger.error(
      { read: which, cause: err instanceof Error ? err.message : String(err) },
      "A durable read of the hot state could not be answered.",
    );
    return fail(new StateUnavailable(what));
  }
}

export function durablePastActivity(deps: DurablePastActivityDeps): PastActivity {
  return {
    arrivalsOf: (merchantId, sessionId) =>
      read(() => deps.events.bySession(merchantId, sessionId), "session", "arrivals", deps.logger),
    decisionsOf: (merchantId, sessionId) =>
      read(() => deps.decisions.bySession(merchantId, sessionId), "session", "decisions", deps.logger),
    decisionsOfVisitor: (merchantId, visitorId, since) =>
      read(
        () => deps.decisions.byVisitor(merchantId, visitorId, since),
        "visitor",
        "visitor-decisions",
        deps.logger,
      ),
  };
}
