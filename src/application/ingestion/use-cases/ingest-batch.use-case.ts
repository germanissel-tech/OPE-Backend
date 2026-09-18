// Use case: ingestion of a batch (FR-012..FR-014, FR-020, FR-021). Invariants → assignment
// (constitution III: recorded when it happens, before any decision) → dedup → NO_OP decision
// with a reason → record in the ledger. Returns a result, never throws on business rules; a
// ledger that cannot accept a record degrades to NO_OP `ledger-unavailable` (ADR-021), so
// LedgerUnavailable is handled here and never reaches the response.
import {
  checkBatch,
  decideArm,
  type EventBatch,
  type IngestionError,
  type NoOpReason,
} from "../../../domain/ingestion/index.js";
import {
  noOp,
  type Decision,
  type DecisionExperiment,
  type NoOpInput,
} from "../../../domain/ledger/index.js";
import { fail, ok, type EventId, type MerchantId, type Result } from "../../../domain/shared-kernel/index.js";
import type { Assignment } from "../../../domain/experiment/index.js";
import type { AssignmentService } from "../../experiment/index.js";
import type { DecisionLedger } from "../../ledger/index.js";
import type { Clock, IdGenerator, Logger, UseCase } from "../../shared-kernel/index.js";
import type { EventDedup } from "../ports/event-dedup.js";

export interface IngestBatchRequest {
  merchantId: MerchantId;
  batch: EventBatch;
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

/** The NO_OP decision of the batch given the visitor's assignment, if any (ADR-022). */
function decideFor(
  base: Omit<NoOpInput, "reason">,
  batch: EventBatch,
  assignment: Assignment | undefined,
): Decision {
  const reason = decideArm(assignment?.arm, batch);
  if (assignment === undefined) return noOp({ ...base, reason });
  const experiment: DecisionExperiment = { experimentId: assignment.experimentId, arm: assignment.arm };
  return noOp({ ...base, experiment, reason });
}

export class IngestBatchUseCase implements UseCase<IngestBatchRequest, IngestBatchResponse> {
  readonly #deps: IngestBatchDependencies;

  constructor(deps: IngestBatchDependencies) {
    this.#deps = deps;
  }

  async execute({ merchantId, batch }: IngestBatchRequest): Promise<IngestBatchResponse> {
    const { clock, ids, eventDedup, assignment } = this.#deps;
    const now = clock.now();
    const check = checkBatch(batch, now);
    if (!check.ok) return fail(check.error);
    const first = batch.events[0];
    if (first === undefined) throw new Error("The contract guarantees at least one event per batch.");

    const assigned = await assignment.assign(merchantId, first.visitorId);
    const results = resultsOf(
      batch,
      await eventDedup.claim(
        merchantId,
        batch.events.map((e) => e.eventId),
      ),
    );
    const accepted = results.filter((r) => r.status === "accepted").length;
    const base: Omit<NoOpInput, "reason"> = {
      decisionId: ids.decisionId(),
      merchantId,
      sessionId: first.sessionId,
      visitorId: first.visitorId,
      decidedAt: now,
    };
    const decision = assigned.ok
      ? await this.#recordOrDegrade(base, decideFor(base, batch, assigned.value))
      : this.#degrade(base, "assignment not recorded");
    return ok({ accepted, duplicates: results.length - accepted, results, decision });
  }

  /** Records the decision; when the ledger cannot, the intervention is suppressed (ADR-021). */
  async #recordOrDegrade(base: Omit<NoOpInput, "reason">, decision: Decision): Promise<Decision> {
    const written = await this.#deps.decisions.record(decision);
    return written.ok ? decision : this.#degrade(base, "decision not recorded");
  }

  #degrade(base: Omit<NoOpInput, "reason">, what: string): Decision {
    this.#deps.logger.error(
      { merchantId: base.merchantId, decisionId: base.decisionId },
      `${what}: ${LEDGER_UNAVAILABLE}`,
    );
    return noOp({ ...base, reason: LEDGER_UNAVAILABLE });
  }
}
