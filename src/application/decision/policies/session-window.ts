// Session window (ADR-026): how long, and how many, sessions the plane remembers per merchant.
// The figures are the deduplication window's (ADR-024), derived from it rather than repeated: a
// session older than a day, or beyond the budget, starts over. Declared here so any store
// applies the same window.
import { DEDUP_WINDOW } from "../../ingestion/index.js";

export interface SessionWindow {
  /** States untouched for longer than this are forgotten. */
  ttlMs: number;
  /** States kept per merchant at most; the least recently updated go first. */
  maxSessions: number;
}

/** The deduplication window, applied to sessions: 24 h since the last batch, or 100,000 per merchant. */
export const SESSION_WINDOW: SessionWindow = { ttlMs: DEDUP_WINDOW.ttlMs, maxSessions: DEDUP_WINDOW.maxIds };
