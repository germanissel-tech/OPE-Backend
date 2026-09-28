// Batch identifier port: ingestion owns the identity of an arrival, so whoever needs one asks this
// generator instead of reaching for crypto — the same shape as the ledger's `DecisionIdGenerator`,
// and for the same reason: a test decides what an identity is, and no use case knows how one is made.
import type { BatchId } from "../../../domain/ingestion/index.js";

export interface BatchIdGenerator {
  next(): BatchId;
}
