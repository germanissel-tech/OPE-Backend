// Eval fixture: stub of the ingestion module's public API.
export type IngestBatch = () => Promise<{ accepted: number }>;
export function makeIngestBatch(deps: { clock: { now(): Date } }): IngestBatch {
  return () => Promise.resolve({ accepted: deps.clock.now().getTime() > 0 ? 1 : 0 });
}
