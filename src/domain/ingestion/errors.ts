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

export type IngestionError = SessionVisitorMismatch | EventTimestampOutOfRange;
