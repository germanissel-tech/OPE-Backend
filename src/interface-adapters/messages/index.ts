// Public API of the messages module (adapters): what the composition wires. Presenters stay internal.
export { memoryTextStore } from "./gateways/memory-text-store.js";
export { sqliteTextStore } from "./gateways/sqlite-text-store.js";
export { makePublishText } from "./controllers/publish-text.js";
