// Where the reading of one flow of a merchant stands (feature 044, ADR-047; research R-10): what the scheduler
// keeps between runs and what an operator reads. A value without rules of its own — the scheduler decides what
// each run leaves — so it is a type (ADR-024). Nothing personal: a count and a reason, never an order.

/** How the last run ended: what it deposited, or why it deposited nothing. */
export type SyncOutcome = { status: "ok"; count: number } | { status: "failed"; reason: string };

export interface SyncState {
  /**
   * Where the next run resumes. `stockAndPrice`: the last variant of the batch, in lexicographic order.
   * `orders` and `returns`: the opaque cursor of the source. `catalog` has none: it reads everything.
   */
  cursor?: string | undefined;
  /** When the last run started; the cadence counts from here, whatever it ended in. */
  lastRunAt?: Date | undefined;
  /** When the last run that failed nothing started. */
  lastOkAt?: Date | undefined;
  lastOutcome?: SyncOutcome | undefined;
}
