// The identity of an event: owned by ingestion (deduplication is per eventId within the merchant).
import type { Branded } from "../shared-kernel/index.js";

export type EventId = Branded<string, "EventId">;

/** The contract already validated the pattern; here only the brand is applied. */
export const asEventId = (value: string): EventId => value as EventId;

/**
 * The identity of **one arrival** — a single batch the SDK posted — owned by ingestion too, because
 * ingestion is what receives it.
 *
 * It is the fifth identity of a system whose constitution fixes four and warns that "collapsing them
 * is the most expensive source of errors", so what it is **not** matters as much as what it is:
 *
 * - not an `eventId`, which identifies an event and legitimately repeats across arrivals — a retry
 *   sends the same one, and the register keeps both because each arrival is a fact (feature 031);
 * - not a `sessionId`, because a session has many arrivals;
 * - not a `decisionId`, which would be the cheap way out and does not work: **a batch rejected by an
 *   invariant produces no decision**, and that is exactly the traffic the register exists to make
 *   visible.
 *
 * OPE mints it on reception. It never comes from the SDK and never reaches it: the ingestion contract
 * does not change because of this feature.
 */
export type BatchId = Branded<string, "BatchId">;

/** Minted by OPE through a port of this module, never read off the wire. */
export const asBatchId = (value: string): BatchId => value as BatchId;
