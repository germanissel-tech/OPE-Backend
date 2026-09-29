// In-memory decision ledger. Composite key merchant + decision: a decision of another merchant
// does not exist for whoever asks. A secondary index merchant + session serves `bySession`.
import { LedgerUnavailable, type Decision, type DecisionId } from "../../../domain/ledger/index.js";
import {
  fail,
  ok,
  type MerchantId,
  type SessionId,
  type VisitorId,
} from "../../../domain/shared-kernel/index.js";
import type { DecisionLedger } from "../../../application/ledger/index.js";

export function memoryDecisionLedger(): DecisionLedger {
  const decisions = new Map<string, Decision>();
  const sessions = new Map<string, Decision[]>();
  const visitors = new Map<string, Decision[]>();
  const key = (merchantId: MerchantId, decisionId: DecisionId): string => `${merchantId}/${decisionId}`;
  const sessionKey = (merchantId: MerchantId, sessionId: SessionId): string => `${merchantId}/${sessionId}`;
  const visitorKey = (merchantId: MerchantId, visitorId: VisitorId): string => `${merchantId}/${visitorId}`;
  return {
    record(decision) {
      const k = key(decision.merchantId, decision.decisionId);
      // A decision already recorded is not overwritten: the ledger is immutable, and a repeated
      // identifier is a broken generator, not an update. Same answer as the durable gateway, so
      // the behaviour does not depend on which one a deployment chose.
      if (decisions.has(k)) return Promise.resolve(fail(new LedgerUnavailable()));
      const sk = sessionKey(decision.merchantId, decision.sessionId);
      sessions.set(sk, [...(sessions.get(sk) ?? []), decision]);
      const vk = visitorKey(decision.merchantId, decision.visitorId);
      visitors.set(vk, [...(visitors.get(vk) ?? []), decision]);
      decisions.set(k, decision);
      return Promise.resolve(ok(undefined));
    },
    find(merchantId, decisionId) {
      return Promise.resolve(decisions.get(key(merchantId, decisionId)));
    },
    bySession(merchantId, sessionId) {
      return Promise.resolve(sessions.get(sessionKey(merchantId, sessionId)) ?? []);
    },
    byVisitor(merchantId, visitorId, since) {
      // The instant this compares is the decision's own, because in memory there is no row and so no
      // second one to approximate it with. The durable gateway's answer is a superset of this one,
      // which is the direction that keeps the two interchangeable: the domain does the exact cut.
      const kept = visitors.get(visitorKey(merchantId, visitorId)) ?? [];
      return Promise.resolve(kept.filter((decision) => decision.decidedAt >= since));
    },
  };
}
