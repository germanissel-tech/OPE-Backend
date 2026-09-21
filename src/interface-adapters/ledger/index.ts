// Public API of the ledger module (adapters ring): decisions and exposures recorded (ADR-021) — what the
// composition wires. Presenters stay internal to the module.
export * from "./controllers/confirm-exposure.js";
export * from "./gateways/memory-decision-ledger.js";
export * from "./gateways/memory-exposure-ledger.js";
export * from "./gateways/random-decision-ids.js";
