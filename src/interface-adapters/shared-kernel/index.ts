// Public API of the shared-kernel module (adapters ring): what the in-memory gateways share: paging, random ids, the system clock and the bounded window per merchant — what the
// composition wires. Presenters stay internal to the module.
export * from "./paging.js";
export * from "./random-id.js";
export * from "./system-clock.js";
export * from "./windowed-map.js";
