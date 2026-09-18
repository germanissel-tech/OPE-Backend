// Deduplication policy (ADR-024): published in the description of ingestEvents, so it is a rule
// of the application, not of whichever store enforces it. A gateway receives it; another
// technology (Redis, Postgres) applies the same window without reinventing it.
import { hours } from "../../../domain/shared-kernel/index.js";

export interface DedupWindow {
  /** Ids older than this are forgotten. */
  ttlMs: number;
  /** Ids kept per merchant at most; the oldest go first. */
  maxIds: number;
}

const DEDUP_TTL_HOURS = 24;
const DEDUP_MAX_IDS = 100_000;

/** 24 h or 100,000 ids per merchant, whichever comes first. */
export const DEDUP_WINDOW: DedupWindow = { ttlMs: hours(DEDUP_TTL_HOURS), maxIds: DEDUP_MAX_IDS };
