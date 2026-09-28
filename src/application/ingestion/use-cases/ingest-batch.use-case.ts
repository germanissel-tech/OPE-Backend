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
import type { Clock, ClockTolerance, UseCase } from "../../shared-kernel/index.js";
import type { BatchIdGenerator } from "../ports/batch-id-generator.js";
import type { DecisionPlane } from "../ports/decision-plane.js";
import type { EventDedup } from "../ports/event-dedup.js";
import type { EventLog } from "../ports/event-log.js";

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

/**
 * Six, which is the maximum ADR-023 allows, and the register is what took it there. The way past it
 * is a service, not a bigger limit — worth knowing before the next thing needs a dependency here.
 */
export interface IngestBatchDependencies {
  clock: Clock;
  tolerance: ClockTolerance;
  eventDedup: EventDedup;
  decisionPlane: DecisionPlane;
  /** Where what arrived is recorded, outside the critical path (feature 031). */
  eventLog: EventLog;
  /** Who names an arrival; OPE mints it on reception and it never reaches the SDK. */
  batchIds: BatchIdGenerator;
}

/**
 * What became of each event, in batch order; a repeated eventId inside the batch counts once.
 *
 * It carries the **event** and not only its id because the register needs both, and looking the event
 * up again by index afterwards would need a fallback for a case that cannot happen — the kind of
 * unreachable branch no test can kill (ADR-016).
 */
function dispositionsOf(
  batch: EventBatch,
  entered: ReadonlySet<EventId>,
): { event: Event; status: "accepted" | "duplicate" }[] {
  const seen = new Set<EventId>();
  return batch.events.map((event) => {
    const status = entered.has(event.eventId) && !seen.has(event.eventId) ? "accepted" : "duplicate";
    seen.add(event.eventId);
    return { event, status };
  });
}

export class IngestBatchUseCase implements UseCase<IngestBatchRequest, IngestBatchResponse> {
  readonly #deps: IngestBatchDependencies;

  constructor(deps: IngestBatchDependencies) {
    this.#deps = deps;
  }

  async execute({ merchantId, events }: IngestBatchRequest): Promise<IngestBatchResponse> {
    const { clock, tolerance, eventDedup, decisionPlane, eventLog, batchIds } = this.#deps;
    const now = clock.now();
    const batchId = batchIds.next();
    const batch = EventBatch.of(events, now, {
      pastMs: tolerance.eventPastMs(),
      futureMs: tolerance.skewMs(),
    });
    if (!batch.ok) {
      // **The second place the register is written, and the only one that can see this traffic.** This
      // path never reaches the decision plane, so there is no decision and never will be — which is
      // precisely what FR-006 asks to be able to see. Today OPE answers `422` and leaves nothing
      // behind, so an operator sees silence and cannot tell it from a merchant that sent nothing.
      //
      // The events are recorded as they arrived, each with its own session and visitor: the invariant
      // fired *because* they did not agree, so there is no single one of the batch to name, and showing
      // the mismatch is what makes the register useful here (research R-07).
      eventLog.record(
        events.map((event, position) => ({
          merchantId,
          batchId,
          position,
          event,
          receivedAt: now,
          disposition: "rejected" as const,
          rejectedBy: batch.error.code,
        })),
      );
      return fail(batch.error);
    }
    const dispositions = dispositionsOf(
      batch.value,
      await eventDedup.claim(merchantId, batch.value.eventIds()),
    );
    const accepted = dispositions.filter((d) => d.status === "accepted").length;
    const decision = await decisionPlane.decide({ merchantId, batch: batch.value, now });
    // **After the decision, because the decision is what the register needs to name** — its identifier
    // and the arm do not exist before this line (feature 031, research R-01). And it does not wait:
    // `record` returns nothing to await, which is what keeps the register off the critical path.
    eventLog.record(
      dispositions.map(({ event, status }, position) => ({
        merchantId,
        batchId,
        position,
        event,
        receivedAt: now,
        disposition: status,
        decisionId: decision.decisionId,
        // Passed straight through: absent when the merchant has no active experiment, which is not
        // CONTROL. Guarding it would be the conditional spread that no test can distinguish.
        arm: decision.experiment?.arm,
      })),
    );
    return ok({
      accepted,
      duplicates: dispositions.length - accepted,
      results: dispositions.map(({ event, status }) => ({ eventId: event.eventId, status })),
      decision,
    });
  }
}
