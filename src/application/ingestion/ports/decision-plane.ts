// Decision plane port (01-arquitectura-mvp.md §4; ADR-026): what the ingestion asks once a
// batch is valid — a decision for it, always, with a reason when it is NO_OP. The ingestion is
// the owner of this contract; the decision module implements it and the composition binds them,
// so the ingestion never depends on the plane (no cycle in the context map).
import type { EventBatch } from "../../../domain/ingestion/index.js";
import type { Decision } from "../../../domain/ledger/index.js";
import type { MerchantId } from "../../../domain/shared-kernel/index.js";

export interface DecisionRequest {
  merchantId: MerchantId;
  batch: EventBatch;
  now: Date;
}

export interface DecisionPlane {
  decide(request: DecisionRequest): Promise<Decision>;
}
