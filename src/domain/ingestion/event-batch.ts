// Batch of events of one session (contract: EventBatch.x-invariants; ADR-007, ADR-024). The
// schema already validated shape and ranges; here live the rules the schema cannot express,
// enforced by construction: an EventBatch only exists valid.
import {
  fail,
  hours,
  minutes,
  ok,
  type NoOpReason,
  type Result,
  type SessionId,
  type VisitorId,
} from "../shared-kernel/index.js";
import { EventTimestampOutOfRange, SessionVisitorMismatch, type IngestionError } from "./errors.js";
import type { Event } from "./event.js";
import type { EventId } from "./ids.js";

/** Tolerance of the instant relative to the backend clock (contract: EventBatch.x-invariants). */
const TOLERANCE_PAST_HOURS = 24;
const TOLERANCE_FUTURE_MINUTES = 5;
export const TIMESTAMP_TOLERANCE = {
  pastMs: hours(TOLERANCE_PAST_HOURS),
  futureMs: minutes(TOLERANCE_FUTURE_MINUTES),
} as const;

export class EventBatch {
  readonly events: readonly Event[];
  readonly sessionId: SessionId;
  readonly visitorId: VisitorId;

  private constructor(events: readonly Event[], first: Event) {
    this.events = events;
    this.sessionId = first.sessionId;
    this.visitorId = first.visitorId;
  }

  /**
   * The batch of these events, or the first violated invariant (in declaration order): every
   * event belongs to the session and visitor of the first one, and every instant is within
   * the tolerance around `now`. An empty list is a programming error: the contract requires
   * at least one event.
   */
  static of(events: readonly Event[], now: Date): Result<EventBatch, IngestionError> {
    const [first, ...rest] = events;
    if (first === undefined) throw new Error("The contract guarantees at least one event per batch.");
    for (const event of rest) {
      if (event.sessionId !== first.sessionId || event.visitorId !== first.visitorId) {
        return fail(new SessionVisitorMismatch(event.eventId));
      }
    }
    const earliest = now.getTime() - TIMESTAMP_TOLERANCE.pastMs;
    const latest = now.getTime() + TIMESTAMP_TOLERANCE.futureMs;
    for (const event of events) {
      const t = event.occurredAt.getTime();
      if (t < earliest || t > latest) return fail(new EventTimestampOutOfRange(event.eventId));
    }
    return ok(new EventBatch([...events], first));
  }

  eventIds(): EventId[] {
    return this.events.map((e) => e.eventId);
  }

  /**
   * Why this batch gets no intervention while there is no decision plane: a product page
   * without a resolved product allows no decision (01-arquitectura-mvp.md §3.1.1); anything
   * else waits for the decision plane. PROPUESTO (ADR-024): moves to the `decision` module
   * with feature 011.
   */
  noOpReason(): NoOpReason {
    const onProductPage = this.events.filter((e) => e.page.pageType === "product");
    if (onProductPage.length > 0 && onProductPage.every((e) => e.page.productId === undefined)) {
      return "page-context-incomplete";
    }
    return "decision-plane-unavailable";
  }
}
