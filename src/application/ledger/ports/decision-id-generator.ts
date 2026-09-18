// Decision identifier port: the ledger owns the identity of a decision; whoever mints one
// (ingestion today, the decision plane tomorrow) receives a generator, never calls crypto.
import type { DecisionId } from "../../../domain/ledger/index.js";

export interface DecisionIdGenerator {
  next(): DecisionId;
}
