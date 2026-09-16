// API pública del módulo ingestion (aplicación).
export { makeIngestBatch } from "./ingest-batch.js";
export type {
  EventResult,
  IngestBatch,
  IngestBatchDeps,
  IngestBatchInput,
  IngestBatchResult,
  IngestOutcome,
} from "./ingest-batch.js";
export type { EventDedup } from "./ports/event-dedup.js";
