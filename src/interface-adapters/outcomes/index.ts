// Public API of the outcomes module (adapters ring): orders, returns and corroborations (ADR-028) — what the
// composition wires. Presenters stay internal to the module.
export * from "./controllers/corroborate-order.js";
export * from "./controllers/notify-order.js";
export * from "./controllers/notify-return.js";
export * from "./gateways/memory-corroboration-ledger.js";
export * from "./gateways/memory-order-ledger.js";
