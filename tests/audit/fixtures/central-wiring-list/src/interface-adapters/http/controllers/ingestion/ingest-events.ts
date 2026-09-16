// Eval fixture: stub controller.
import type { IngestBatch } from "../../../../application/ingestion/index.js";
export function makeIngestEvents(ingestBatch: IngestBatch): () => Promise<unknown> {
  return () => ingestBatch();
}
