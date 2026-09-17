// Use case: ingestion of a batch (FR-012..FR-014, FR-020, FR-021). Invariants → assignment
// (constitution III: recorded when it happens, before any decision) → dedup → NO_OP decision
// with a reason → record in the ledger. Returns a result, never throws on business rules; a
// ledger that cannot accept a record degrades to NO_OP `ledger-unavailable` (ADR-021).
import {
  checkBatch,
  decideArm,
  type BatchInvariant,
  type EventBatch,
  type NoOpReason,
} from "../../domain/ingestion/index.js";
import { noOp, type Decision, type DecisionExperiment, type NoOpInput } from "../../domain/ledger/index.js";
import type { EventId, MerchantId } from "../../domain/shared-kernel/index.js";
import type { AssignVisitor } from "../experiment/index.js";
import type { DecisionLedger } from "../ledger/index.js";
import type { Clock, IdGenerator, Logger } from "../shared-kernel/index.js";
import type { EventDedup } from "./ports/event-dedup.js";

export interface IngestBatchInput {
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

export type IngestBatchResult =
  { ok: true; outcome: IngestOutcome } | { ok: false; invariant: BatchInvariant; detail: string };

export type IngestBatch = (input: IngestBatchInput) => Promise<IngestBatchResult>;

export interface IngestBatchDeps {
  clock: Clock;
  ids: IdGenerator;
  logger: Logger;
  eventDedup: EventDedup;
  decisions: DecisionLedger;
  assignVisitor: AssignVisitor;
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

export function makeIngestBatch(deps: IngestBatchDeps): IngestBatch {
  const { clock, ids, logger, eventDedup, decisions, assignVisitor } = deps;

  /** Records the decision; when the ledger cannot, the intervention is suppressed (ADR-021). */
  const recordOrDegrade = async (base: Omit<NoOpInput, "reason">, decision: Decision): Promise<Decision> => {
    if ((await decisions.record(decision)) !== "unavailable") return decision;
    logger.error(
      { merchantId: base.merchantId, decisionId: base.decisionId },
      "decision not recorded: ledger-unavailable",
    );
    return noOp({ ...base, reason: LEDGER_UNAVAILABLE });
  };

  return async ({ merchantId, batch }) => {
    const now = clock.now();
    const check = checkBatch(batch, now);
    if (!check.ok) return { ok: false, invariant: check.invariant, detail: check.detail };
    const first = batch.events[0];
    if (first === undefined) throw new Error("The contract guarantees at least one event per batch.");

    const assigned = await assignVisitor({ merchantId, visitorId: first.visitorId });
    const results = resultsOf(
      batch,
      await eventDedup.claim(
        merchantId,
        batch.events.map((e) => e.eventId),
      ),
    );
    const accepted = results.filter((r) => r.status === "accepted").length;
    const base = {
      decisionId: ids.decisionId(),
      merchantId,
      sessionId: first.sessionId,
      visitorId: first.visitorId,
      decidedAt: now,
    };

    let decision: Decision;
    if (assigned.ok) {
      const experiment: DecisionExperiment | undefined = assigned.assignment && {
        experimentId: assigned.assignment.experimentId,
        arm: assigned.assignment.arm,
      };
      const reason = decideArm(experiment?.arm, batch);
      decision = await recordOrDegrade(
        base,
        noOp(experiment ? { ...base, experiment, reason } : { ...base, reason }),
      );
    } else {
      logger.error(
        { merchantId, decisionId: base.decisionId },
        "assignment not recorded: ledger-unavailable",
      );
      decision = noOp({ ...base, reason: LEDGER_UNAVAILABLE });
    }
    return { ok: true, outcome: { accepted, duplicates: results.length - accepted, results, decision } };
  };
}
