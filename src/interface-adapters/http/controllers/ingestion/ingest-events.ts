// ingestEvents (FR-010..FR-016, FR-020): contract DTO → domain batch → use case → 202
// IngestResult, or 422 with the type of the violated invariant. The body already passed the
// contract validation; here it is only translated (branded ids, instants, union by `type`).
import { asEventId, asSessionId, asVisitorId } from "../../../../domain/shared-kernel/index.js";
import { merchantOf } from "../../security/ingest-key.js";
import { toProblem } from "../../to-problem.js";
import type { IngestBatchRequest, IngestBatchResponse } from "../../../../application/ingestion/index.js";
import type { UseCase } from "../../../../application/shared-kernel/index.js";
import type { Event } from "../../../../domain/ingestion/index.js";
import type { Decision } from "../../../../domain/ledger/index.js";
import type { components } from "../../generated/api.js";
import type { OperationHandler } from "../../typed.js";

type EventDto = components["schemas"]["Event"];
type DecisionDto = components["schemas"]["Decision"];

/** An event DTO → domain event. The `switch` is exhaustive: a new type does not compile without a branch. */
function toDomainEvent(dto: EventDto): Event {
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

/** A domain decision → DTO. `merchantId` and `decidedAt` do not travel. */
function toDecisionDto(decision: Decision): DecisionDto {
  const dto: DecisionDto = {
    decisionId: decision.decisionId,
    sessionId: decision.sessionId,
    outcome: decision.outcome,
    reason: decision.reason,
  };
  if (decision.intervention) dto.intervention = decision.intervention;
  return dto;
}

export function makeIngestEvents(
  ingestBatch: UseCase<IngestBatchRequest, IngestBatchResponse>,
): OperationHandler<"ingestEvents"> {
  return async (req) => {
    const merchant = merchantOf(req);
    const result = await ingestBatch.execute({
      merchantId: merchant.merchantId,
      batch: { events: req.body.events.map(toDomainEvent) },
    });
    if (!result.ok) return toProblem(result.error, req.instance);
    const { accepted, duplicates, results, decision } = result.value;
    return {
      status: 202,
      body: { accepted, duplicates, results, decision: toDecisionDto(decision) },
    };
  };
}
