// Public API of the shared-kernel module (application): cross-cutting ports.
export type { Clock } from "./ports/clock.js";
export type { IdGenerator } from "./ports/id-generator.js";
export type { LogFields, Logger } from "./ports/logger.js";
