// Session window (ADR-026): how long, and how many, sessions the plane remembers per merchant.
// The same figures as the deduplication window (ADR-024): a session older than a day, or beyond
// the budget, starts over. Declared here so any store applies the same window.
import { hours } from "../../../domain/shared-kernel/index.js";

export interface SessionWindow {
  /** States untouched for longer than this are forgotten. */
  ttlMs: number;
  /** States kept per merchant at most; the least recently updated go first. */
  maxSessions: number;
}

const SESSION_TTL_HOURS = 24;
const SESSION_MAX = 100_000;

/** 24 h since the last batch, or 100,000 sessions per merchant, whichever comes first. */
export const SESSION_WINDOW: SessionWindow = { ttlMs: hours(SESSION_TTL_HOURS), maxSessions: SESSION_MAX };
