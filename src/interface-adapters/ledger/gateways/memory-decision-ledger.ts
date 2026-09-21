// In-memory decision ledger. Composite key merchant + decision: a decision of another merchant
// does not exist for whoever asks. A secondary index merchant + session serves `bySession`.
import { ok, type MerchantId, type SessionId } from "../../../domain/shared-kernel/index.js";
import type { DecisionLedger } from "../../../application/ledger/index.js";
import type { Decision, DecisionId } from "../../../domain/ledger/index.js";

export function memoryDecisionLedger(): DecisionLedger {
  const decisions = new Map<string, Decision>();
  const sessions = new Map<string, Decision[]>();
  const key = (merchantId: MerchantId, decisionId: DecisionId): string => `${merchantId}/${decisionId}`;
  const sessionKey = (merchantId: MerchantId, sessionId: SessionId): string => `${merchantId}/${sessionId}`;
  return {
    record(decision) {
      const k = key(decision.merchantId, decision.decisionId);
      if (!decisions.has(k)) {
        const sk = sessionKey(decision.merchantId, decision.sessionId);
        sessions.set(sk, [...(sessions.get(sk) ?? []), decision]);
      }
      decisions.set(k, decision);
      return Promise.resolve(ok(undefined));
    },
    find(merchantId, decisionId) {
      return Promise.resolve(decisions.get(key(merchantId, decisionId)));
    },
    bySession(merchantId, sessionId) {
      return Promise.resolve(sessions.get(sessionKey(merchantId, sessionId)) ?? []);
    },
  };
}
