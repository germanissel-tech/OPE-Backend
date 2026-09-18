// The identity of a decision: owned by the ledger, referenced by whoever records or exposes one.
import type { Branded } from "../shared-kernel/index.js";

export type DecisionId = Branded<string, "DecisionId">;

/** The contract already validated the pattern; here only the brand is applied. */
export const asDecisionId = (value: string): DecisionId => value as DecisionId;
