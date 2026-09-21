// Public API of the ingestion module (adapters ring): the ingestion of events and its deduplication — what the
// composition wires. Presenters stay internal to the module.
export * from "./controllers/ingest-events.js";
export * from "./gateways/memory-event-dedup.js";
