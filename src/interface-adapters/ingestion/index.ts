// Public API of the ingestion module (adapters ring): the ingestion of events and its deduplication — what the
// composition wires. Presenters stay internal to the module.
export * from "./controllers/ingest-events.js";
export * from "./gateways/dedup-window.js";
export * from "./gateways/memory-event-dedup.js";
export * from "./gateways/recovering-event-dedup.js";
export * from "./gateways/random-batch-ids.js";
export * from "./gateways/memory-event-log.js";
export * from "./gateways/sqlite-event-log.js";
export * from "./queue/event-log-queue.js";
