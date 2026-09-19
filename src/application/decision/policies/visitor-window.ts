// Visitor window (ADR-027): how long, and how many, visitors the plane remembers per merchant
// for the fatigue limit. A day since the last intervention, or a budget of visitors, whichever
// comes first. Declared here so any store applies the same window.
import { hours } from "../../../domain/shared-kernel/index.js";

export interface VisitorWindow {
  /** Interventions older than this no longer count; a visitor untouched for this long is forgotten. */
  ttlMs: number;
  /** Visitors kept per merchant at most; the least recently updated go first. */
  maxVisitors: number;
}

const VISITOR_TTL_HOURS = 24;
const VISITOR_MAX = 100_000;

/** 24 h since the last intervention, or 100,000 visitors per merchant, whichever comes first. */
export const VISITOR_WINDOW: VisitorWindow = { ttlMs: hours(VISITOR_TTL_HOURS), maxVisitors: VISITOR_MAX };
