// Batch of events of one session and its invariants (contract: EventBatch.x-invariants; ADR-007).
// The schema already validated shape and ranges; here go the rules the schema cannot express.
import { hours, minutes } from "../shared-kernel/index.js";
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

export type BatchInvariant = "session-visitor-mismatch" | "event-timestamp-out-of-range";

export type BatchCheck = { ok: true } | { ok: false; invariant: BatchInvariant; detail: string };

/** Returns the first violated invariant (in declaration order) or `ok`. */
export function checkBatch(batch: EventBatch, now: Date): BatchCheck {
  const [first, ...rest] = batch.events;
  if (first === undefined) return { ok: true };
  for (const event of rest) {
    if (event.sessionId !== first.sessionId || event.visitorId !== first.visitorId) {
      return {
        ok: false,
        invariant: "session-visitor-mismatch",
        detail: `Event ${event.eventId} does not belong to the session and visitor of the batch.`,
      };
    }
  }
  const earliest = now.getTime() - TIMESTAMP_TOLERANCE.pastMs;
  const latest = now.getTime() + TIMESTAMP_TOLERANCE.futureMs;
  for (const event of batch.events) {
    const t = event.occurredAt.getTime();
    if (Number.isNaN(t) || t < earliest || t > latest) {
      return {
        ok: false,
        invariant: "event-timestamp-out-of-range",
        detail: `The timestamp of event ${event.eventId} is out of tolerance (24 h in the past, 5 min in the future).`,
      };
    }
  }
  return { ok: true };
}
