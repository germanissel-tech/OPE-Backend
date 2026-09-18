// Batch of events of one session and its invariants (contract: EventBatch.x-invariants; ADR-007).
// The schema already validated shape and ranges; here go the rules the schema cannot express.
import { fail, hours, minutes, ok, type Result } from "../shared-kernel/index.js";
import { EventTimestampOutOfRange, SessionVisitorMismatch, type IngestionError } from "./errors.js";
import type { Event } from "./event.js";

export interface EventBatch {
  events: readonly Event[];
}

/** Tolerance of the instant relative to the backend clock (contract: EventBatch.x-invariants). */
const TOLERANCE_PAST_HOURS = 24;
const TOLERANCE_FUTURE_MINUTES = 5;
export const TIMESTAMP_TOLERANCE = {
  pastMs: hours(TOLERANCE_PAST_HOURS),
  futureMs: minutes(TOLERANCE_FUTURE_MINUTES),
} as const;

/** Returns the first violated invariant (in declaration order) or `ok`. */
export function checkBatch(batch: EventBatch, now: Date): Result<void, IngestionError> {
  const [first, ...rest] = batch.events;
  if (first === undefined) return ok(undefined);
  for (const event of rest) {
    if (event.sessionId !== first.sessionId || event.visitorId !== first.visitorId) {
      return fail(new SessionVisitorMismatch(event.eventId));
    }
  }
  const earliest = now.getTime() - TIMESTAMP_TOLERANCE.pastMs;
  const latest = now.getTime() + TIMESTAMP_TOLERANCE.futureMs;
  for (const event of batch.events) {
    const t = event.occurredAt.getTime();
    if (Number.isNaN(t) || t < earliest || t > latest)
      return fail(new EventTimestampOutOfRange(event.eventId));
  }
  return ok(undefined);
}
