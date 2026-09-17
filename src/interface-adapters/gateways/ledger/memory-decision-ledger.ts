// In-memory decision ledger. Composite key merchant + decision: a decision of another merchant
// does not exist for whoever asks.
import type { DecisionLedger } from "../../../application/ledger/index.js";
import type { Decision } from "../../../domain/ledger/index.js";
import type { DecisionId, MerchantId } from "../../../domain/shared-kernel/index.js";

export function memoryDecisionLedger(): DecisionLedger {
  const decisions = new Map<string, Decision>();
  const key = (merchantId: MerchantId, decisionId: DecisionId): string => `${merchantId}/${decisionId}`;
  return {
    record(decision) {
      decisions.set(key(decision.merchantId, decision.decisionId), decision);
      return "accepted";
    },
    find(merchantId, decisionId) {
      return decisions.get(key(merchantId, decisionId));
    },
  };
}
