// Use case: ingestion of a batch (FR-012..FR-014, FR-020, FR-021). Invariants → dedup → the
// decision plane decides (assignment, inference, evidence, verdict and the ledger are its, 01
// §4; ADR-026) → the response. Returns a result, never throws on business rules; the plane
// always answers a decision, degraded to NO_OP `ledger-unavailable` when the ledger cannot
// record (ADR-021), so nothing here needs to handle that.
import {
  EventBatch,
  type Event,
  type EventId,
  type IngestionError,
} from "../../../domain/ingestion/index.js";
import { fail, ok, type MerchantId, type Result } from "../../../domain/shared-kernel/index.js";
import type { Decision } from "../../../domain/ledger/index.js";
import type { Clock, UseCase } from "../../shared-kernel/index.js";
import type { DecisionPlane } from "../ports/decision-plane.js";
import type { EventDedup } from "../ports/event-dedup.js";

export interface IngestBatchRequest {
  merchantId: MerchantId;
  events: readonly Event[];
}

export interface EventResult {
  eventId: EventId;
  status: "accepted" | "duplicate";
}

export interface IngestOutcome {
  accepted: number;
  duplicates: number;
  results: EventResult[];
  decision: Decision;
}

export type IngestBatchResponse = Result<IngestOutcome, IngestionError>;

export interface IngestBatchDependencies {
  clock: Clock;
  eventDedup: EventDedup;
  decisionPlane: DecisionPlane;
}

/** One result per event, in batch order; a repeated eventId inside the batch counts once. */
function resultsOf(batch: EventBatch, entered: ReadonlySet<EventId>): EventResult[] {
  const seen = new Set<EventId>();
  return batch.events.map((e) => {
    const status = entered.has(e.eventId) && !seen.has(e.eventId) ? "accepted" : "duplicate";
    seen.add(e.eventId);
    return { eventId: e.eventId, status };
  });
}

export class IngestBatchUseCase implements UseCase<IngestBatchRequest, IngestBatchResponse> {
  readonly #deps: IngestBatchDependencies;

  constructor(deps: IngestBatchDependencies) {
    this.#deps = deps;
  }

  async execute({ merchantId, events }: IngestBatchRequest): Promise<IngestBatchResponse> {
    const { clock, eventDedup, decisionPlane } = this.#deps;
    const now = clock.now();
    const batch = EventBatch.of(events, now);
    if (!batch.ok) return fail(batch.error);
    const results = resultsOf(batch.value, await eventDedup.claim(merchantId, batch.value.eventIds()));
    const accepted = results.filter((r) => r.status === "accepted").length;
    const decision = await decisionPlane.decide({ merchantId, batch: batch.value, now });
    return ok({ accepted, duplicates: results.length - accepted, results, decision });
  }
}
