// Public API of the ingestion module (application).
export type { DedupWindow, EventDedup } from "./ports/event-dedup.js";
export type { DecisionPlane, DecisionRequest } from "./ports/decision-plane.js";
export { IngestBatchUseCase } from "./use-cases/ingest-batch.use-case.js";
export type {
  EventResult,
  IngestBatchDependencies,
  IngestBatchRequest,
  IngestBatchResponse,
  IngestOutcome,
} from "./use-cases/ingest-batch.use-case.js";
