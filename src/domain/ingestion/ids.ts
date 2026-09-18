// The identity of an event: owned by ingestion (deduplication is per eventId within the merchant).
import type { Branded } from "../shared-kernel/index.js";

export type EventId = Branded<string, "EventId">;

/** The contract already validated the pattern; here only the brand is applied. */
export const asEventId = (value: string): EventId => value as EventId;
