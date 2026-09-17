// Result of every write to a ledger (ADR-021). "accepted" means accepted into the write
// buffer (durable later, asynchronously); "unavailable" means the buffer is full or the store
// is down, and the caller fails closed. No ledger port throws for unavailability.
export type RecordOutcome = "accepted" | "unavailable";
