// Batch of events of one session (contract: EventBatch.x-invariants; ADR-007, ADR-024). The
// schema already validated shape and ranges; here live the rules the schema cannot express,
// enforced by construction: an EventBatch only exists valid.
import {
  CLOCK_SKEW_TOLERANCE_MS,
  fail,
  hours,
  ok,
  type Result,
  type SessionId,
  type VisitorId,
} from "../shared-kernel/index.js";
import { EventTimestampOutOfRange, SessionVisitorMismatch, type IngestionError } from "./errors.js";
import type { Event, PageType } from "./event.js";
import type { EventId } from "./ids.js";

/**
 * Tolerance of the instant relative to the backend clock (contract: EventBatch.x-invariants):
 * a day into the past for late uploads; into the future, the clock skew every instant a client
 * declares is allowed (shared-kernel).
 */
const TOLERANCE_PAST_HOURS = 24;
export const TIMESTAMP_TOLERANCE = {
  pastMs: hours(TOLERANCE_PAST_HOURS),
  futureMs: CLOCK_SKEW_TOLERANCE_MS,
} as const;

const PRODUCT_PAGE = "product" satisfies PageType;

/** The product (and variant, when the SDK resolved one) a batch is about. */
export interface ProductFocus {
  productId: string;
  variantId?: string;
}

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
      if (t < earliest || t > latest) {
        return fail(new EventTimestampOutOfRange(event.eventId, TIMESTAMP_TOLERANCE));
      }
    }
    return ok(new EventBatch([...events], first));
  }

  eventIds(): EventId[] {
    return this.events.map((e) => e.eventId);
  }

  /**
   * The product page the visitor is on: the last event of a product page whose product the SDK
   * resolved (01-arquitectura-mvp.md §3.1.1). Undefined when no event of the batch is on a
   * resolved product page: nothing can be decided about a product (page context incomplete).
   */
  focus(): ProductFocus | undefined {
    const resolved = this.events.filter(
      (e) => e.page.pageType === PRODUCT_PAGE && e.page.productId !== undefined,
    );
    const page = resolved.at(-1)?.page;
    if (page?.productId === undefined) return undefined;
    return page.variantId === undefined
      ? { productId: page.productId }
      : { productId: page.productId, variantId: page.variantId };
  }
}
