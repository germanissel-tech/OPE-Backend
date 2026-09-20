// Decision identifier port: the ledger owns the identity of a decision; its recorder
// (`DefaultDecisionRecorder`) mints one per decision through this generator, never calling crypto.
import type { DecisionId } from "../../../domain/ledger/index.js";

export interface DecisionIdGenerator {
  next(): DecisionId;
}
