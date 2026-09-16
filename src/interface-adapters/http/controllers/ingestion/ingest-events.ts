// ingestEvents (FR-010..FR-016, FR-020): DTO del contrato → lote del dominio → caso de uso → 202
// IngestResult, o 422 con el tipo de la invariante violada. El body ya pasó la validación del
// contrato; acá sólo se traduce (ids marcados, instantes, unión por `type`).
import { asEventId, asSessionId, asVisitorId } from "../../../../domain/shared-kernel/index.js";
import { problem } from "../../problem-details.js";
import { merchantOf } from "../../security/ingest-key.js";
import type { IngestBatch } from "../../../../application/ingestion/index.js";
import type { Event } from "../../../../domain/ingestion/index.js";
import type { Decision } from "../../../../domain/ledger/index.js";
import type { components } from "../../generated/api.js";
import type { OperationHandler } from "../../typed.js";

type EventDto = components["schemas"]["Event"];
type DecisionDto = components["schemas"]["Decision"];

/** Un DTO de evento → evento del dominio. El `switch` es exhaustivo: un tipo nuevo no compila sin rama. */
export function toDomainEvent(dto: EventDto): Event {
  const base = {
    eventId: asEventId(dto.eventId),
    sessionId: asSessionId(dto.sessionId),
    visitorId: asVisitorId(dto.visitorId),
    occurredAt: new Date(dto.occurredAt),
    page: dto.page,
    device: dto.device,
  };
  switch (dto.type) {
    case "product_viewed":
    case "listing_viewed":
    case "removed_from_cart":
      return { ...base, type: dto.type };
    case "size_selector_interacted":
      return { ...base, type: dto.type, size: dto.size };
    case "variant_selected":
      return { ...base, type: dto.type, selectedVariantId: dto.selectedVariantId };
    case "photo_interacted":
      return { ...base, type: dto.type, interaction: dto.interaction };
    case "block_dwelled":
      return { ...base, type: dto.type, block: dto.block, dwellMs: dto.dwellMs };
    case "cta_approached":
      return { ...base, type: dto.type, approach: dto.approach };
    case "product_returned_to":
      return { ...base, type: dto.type, previousProductId: dto.previousProductId };
    case "added_to_cart":
      return { ...base, type: dto.type, quantity: dto.quantity };
    case "checkout_advanced":
      return { ...base, type: dto.type, step: dto.step };
    case "exit_signaled":
      return { ...base, type: dto.type, signal: dto.signal };
  }
}

/** Una decisión del dominio → DTO. `merchantId` y `decidedAt` no viajan. */
export function toDecisionDto(decision: Decision): DecisionDto {
  const dto: DecisionDto = {
    decisionId: decision.decisionId,
    sessionId: decision.sessionId,
    outcome: decision.outcome,
    reason: decision.reason,
  };
  if (decision.intervention) dto.intervention = decision.intervention;
  return dto;
}

export function makeIngestEvents(ingestBatch: IngestBatch): OperationHandler<"ingestEvents"> {
  return async (req) => {
    const merchant = merchantOf(req);
    const result = await ingestBatch({
      merchantId: merchant.merchantId,
      batch: { events: req.body.events.map(toDomainEvent) },
    });
    if (!result.ok) {
      const { status, body } = problem(result.invariant, { instance: req.instance, detail: result.detail });
      return { status: 422, body: { ...body, status } };
    }
    const { accepted, duplicates, results, decision } = result.outcome;
    return {
      status: 202,
      body: { accepted, duplicates, results, decision: toDecisionDto(decision) },
    };
  };
}
