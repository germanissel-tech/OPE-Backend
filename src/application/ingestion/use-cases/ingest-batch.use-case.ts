// Use case: ingestion of a batch (FR-012..FR-014, FR-020, FR-021). Invariants → assignment
// (constitution III: recorded when it happens, before any decision) → dedup → NO_OP decision
// with a reason → record in the ledger. Returns a result, never throws on business rules; a
// ledger that cannot accept a record degrades to NO_OP `ledger-unavailable` (ADR-021), so
// LedgerUnavailable is handled here and never reaches the response.
import { EventBatch, type Event, type IngestionError } from "../../../domain/ingestion/index.js";
import { NoOpDecision, type Decision, type DecisionFacts } from "../../../domain/ledger/index.js";
import {
  fail,
  ok,
  type EventId,
  type MerchantId,
  type NoOpReason,
  type Result,
} from "../../../domain/shared-kernel/index.js";
import type { Assignment } from "../../../domain/experiment/index.js";
import type { AssignmentService } from "../../experiment/index.js";
import type { DecisionLedger } from "../../ledger/index.js";
import type { Clock, IdGenerator, Logger, UseCase } from "../../shared-kernel/index.js";
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
  ids: IdGenerator;
  logger: Logger;
  eventDedup: EventDedup;
  decisions: DecisionLedger;
  assignment: AssignmentService;
}

const LEDGER_UNAVAILABLE: NoOpReason = "ledger-unavailable";

/** One result per event, in batch order; a repeated eventId inside the batch counts once. */
function resultsOf(batch: EventBatch, entered: ReadonlySet<EventId>): EventResult[] {
  const seen = new Set<EventId>();
  return batch.events.map((e) => {
    const status = entered.has(e.eventId) && !seen.has(e.eventId) ? "accepted" : "duplicate";
    seen.add(e.eventId);
    return { eventId: e.eventId, status };
  });
}

/** The reason of the NO_OP: the arm short-circuits before the batch is read (ADR-022). */
function reasonFor(batch: EventBatch, assignment: Assignment | undefined): NoOpReason {
  if (assignment === undefined) return "no-active-experiment";
  if (assignment.arm === "CONTROL") return "control-arm";
  return batch.noOpReason();
}

export class IngestBatchUseCase implements UseCase<IngestBatchRequest, IngestBatchResponse> {
  readonly #deps: IngestBatchDependencies;

  constructor(deps: IngestBatchDependencies) {
    this.#deps = deps;
  }

  async execute({ merchantId, events }: IngestBatchRequest): Promise<IngestBatchResponse> {
    const { clock, ids, eventDedup, assignment } = this.#deps;
    const now = clock.now();
    const batch = EventBatch.of(events, now);
    if (!batch.ok) return fail(batch.error);

    const assigned = await assignment.assign(merchantId, batch.value.visitorId);
    const results = resultsOf(batch.value, await eventDedup.claim(merchantId, batch.value.eventIds()));
    const accepted = results.filter((r) => r.status === "accepted").length;
    const facts: DecisionFacts = {
      decisionId: ids.decisionId(),
      merchantId,
      sessionId: batch.value.sessionId,
      visitorId: batch.value.visitorId,
      decidedAt: now,
    };

    let decision: Decision;
    if (assigned.ok) {
      const experiment = assigned.value && {
        experimentId: assigned.value.experimentId,
        arm: assigned.value.arm,
      };
      const noOp = NoOpDecision.of(
        experiment ? { ...facts, experiment } : facts,
        reasonFor(batch.value, assigned.value),
      );
      decision = await this.#recordOrDegrade(facts, noOp);
    } else {
      decision = this.#degrade(facts, "assignment not recorded");
    }
    return ok({ accepted, duplicates: results.length - accepted, results, decision });
  }

  /** Records the decision; when the ledger cannot, the intervention is suppressed (ADR-021). */
  async #recordOrDegrade(facts: DecisionFacts, decision: Decision): Promise<Decision> {
    const written = await this.#deps.decisions.record(decision);
    return written.ok ? decision : this.#degrade(facts, "decision not recorded");
  }

  #degrade(facts: DecisionFacts, what: string): Decision {
    this.#deps.logger.error(
      { merchantId: facts.merchantId, decisionId: facts.decisionId },
      `${what}: ${LEDGER_UNAVAILABLE}`,
    );
    return NoOpDecision.of(facts, LEDGER_UNAVAILABLE);
  }
}
