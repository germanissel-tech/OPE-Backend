// In-memory decision ledger. Composite key merchant + decision: a decision of another merchant
// does not exist for whoever asks. A secondary index merchant + session serves `bySession`.
import { LedgerUnavailable, type Decision, type DecisionId } from "../../../domain/ledger/index.js";
import { fail, ok, type MerchantId, type SessionId } from "../../../domain/shared-kernel/index.js";
import type { DecisionLedger } from "../../../application/ledger/index.js";

export function memoryDecisionLedger(): DecisionLedger {
  const decisions = new Map<string, Decision>();
  const sessions = new Map<string, Decision[]>();
  const key = (merchantId: MerchantId, decisionId: DecisionId): string => `${merchantId}/${decisionId}`;
  const sessionKey = (merchantId: MerchantId, sessionId: SessionId): string => `${merchantId}/${sessionId}`;
  return {
    record(decision) {
      const k = key(decision.merchantId, decision.decisionId);
      // A decision already recorded is not overwritten: the ledger is immutable, and a repeated
      // identifier is a broken generator, not an update. Same answer as the durable gateway, so
      // the behaviour does not depend on which one a deployment chose.
      if (decisions.has(k)) return Promise.resolve(fail(new LedgerUnavailable()));
      const sk = sessionKey(decision.merchantId, decision.sessionId);
      sessions.set(sk, [...(sessions.get(sk) ?? []), decision]);
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
