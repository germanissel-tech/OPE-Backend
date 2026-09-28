// Business errors of the ingestion module (ADR-023): the batch invariants the schema cannot
// express (contract: EventBatch.x-invariants; ADR-007).
import { DomainError } from "../shared-kernel/index.js";

const MODULE = "ingestion" as const;

export class SessionVisitorMismatch extends DomainError {
  readonly code = "session-visitor-mismatch" as const;
  readonly module = MODULE;
  constructor(eventId: string) {
    super(`Event ${eventId} does not belong to the session and visitor of the batch.`);
  }
}

/** The tolerance travels in `details`: the message does not repeat what its constant owns (015 F-022). */
export class EventTimestampOutOfRange extends DomainError {
  readonly code = "event-timestamp-out-of-range" as const;
  readonly module = MODULE;
  constructor(eventId: string, tolerance: { pastMs: number; futureMs: number }) {
    super(`The timestamp of event ${eventId} is out of tolerance.`, {
      eventId,
      pastMs: tolerance.pastMs,
      futureMs: tolerance.futureMs,
    });
  }
}

// Feature 031 wanted a third error here — a row of the register that says something untrue about why
// traffic was not intervened — and it does not exist on purpose. Two gates said why: an error of the
// domain has to appear in the public catalogue of problem types, and that one would never be emitted
// by any endpoint, because it is not a business error but a programming mistake. So the shape of
// `RecordedEvent` makes it a compile error instead (see `recorded-event.ts`).

export type IngestionError = SessionVisitorMismatch | EventTimestampOutOfRange;
