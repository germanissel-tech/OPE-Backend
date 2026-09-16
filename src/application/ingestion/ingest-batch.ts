// Caso de uso: ingesta de un lote (FR-012..FR-014, FR-020, FR-021). Invariantes → dedup → decisión
// NO_OP con motivo → registro en el ledger. Devuelve un resultado, nunca lanza por reglas de negocio.
import { checkBatch, decide, type BatchInvariant, type EventBatch } from "../../domain/ingestion/index.js";
import { noOp, type Decision } from "../../domain/ledger/index.js";
import type { EventId, MerchantId } from "../../domain/shared-kernel/index.js";
import type { DecisionLedger } from "../ledger/index.js";
import type { Clock, IdGenerator } from "../shared-kernel/index.js";
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
  eventDedup: EventDedup;
  decisions: DecisionLedger;
}

export function makeIngestBatch({ clock, ids, eventDedup, decisions }: IngestBatchDeps): IngestBatch {
  return async ({ merchantId, batch }) => {
    const now = clock.now();
    const check = checkBatch(batch, now);
    if (!check.ok) return { ok: false, invariant: check.invariant, detail: check.detail };

    const first = batch.events[0];
    if (first === undefined) throw new Error("El contrato garantiza al menos un evento por lote.");

    const entered = await eventDedup.claim(
      merchantId,
      batch.events.map((e) => e.eventId),
    );
    const seen = new Set<EventId>();
    const results: EventResult[] = batch.events.map((e) => {
      const status = entered.has(e.eventId) && !seen.has(e.eventId) ? "accepted" : "duplicate";
      seen.add(e.eventId);
      return { eventId: e.eventId, status };
    });
    const accepted = results.filter((r) => r.status === "accepted").length;

    const decision = noOp({
      decisionId: ids.decisionId(),
      merchantId,
      sessionId: first.sessionId,
      visitorId: first.visitorId,
      decidedAt: now,
      reason: decide(batch),
    });
    await decisions.record(decision);

    return { ok: true, outcome: { accepted, duplicates: results.length - accepted, results, decision } };
  };
}
