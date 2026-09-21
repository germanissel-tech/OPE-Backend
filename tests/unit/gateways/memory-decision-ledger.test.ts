// Feature 013 (R-03): the decision ledger in memory answers what it knows of a session, per
// merchant and in the order recorded; a decision of another merchant does not exist.
import { describe, expect, it } from "vitest";
import { asDecisionId, NoOpDecision, type DecisionFacts } from "../../../src/domain/ledger/index.js";
import { asMerchantId, asSessionId, asVisitorId } from "../../../src/domain/shared-kernel/index.js";
import { memoryDecisionLedger } from "../../../src/interface-adapters/gateways/ledger/memory-decision-ledger.js";

const A = asMerchantId("m_a");
const B = asMerchantId("m_b");
const S = asSessionId("sess_0001");

const facts = (id: string, over: Partial<DecisionFacts> = {}): DecisionFacts => ({
  decisionId: asDecisionId(id),
  merchantId: A,
  sessionId: S,
  visitorId: asVisitorId("vis_0001"),
  decidedAt: new Date("2026-09-19T12:00:00.000Z"),
  configuration: { platform: "platform-1", defaults: "defaults-1" },
  ...over,
});

describe("memoryDecisionLedger", () => {
  it("finds by merchant and decision; another merchant sees nothing", async () => {
    const ledger = memoryDecisionLedger();
    const decision = NoOpDecision.of(facts("dec_1"), "control-arm");
    await ledger.record(decision);
    expect(await ledger.find(A, asDecisionId("dec_1"))).toBe(decision);
    expect(await ledger.find(B, asDecisionId("dec_1"))).toBeUndefined();
  });

  it("bySession: the decisions of the session in the order recorded, per merchant", async () => {
    const ledger = memoryDecisionLedger();
    const first = NoOpDecision.of(facts("dec_1"), "barrier-unclear");
    const second = NoOpDecision.of(facts("dec_2"), "control-arm");
    const elsewhere = NoOpDecision.of(facts("dec_3", { sessionId: asSessionId("sess_0002") }), "control-arm");
    const foreign = NoOpDecision.of(facts("dec_4", { merchantId: B }), "control-arm");
    for (const d of [first, second, elsewhere, foreign]) await ledger.record(d);
    expect(await ledger.bySession(A, S)).toEqual([first, second]);
    expect(await ledger.bySession(A, asSessionId("sess_0002"))).toEqual([elsewhere]);
    expect(await ledger.bySession(B, S)).toEqual([foreign]);
    expect(await ledger.bySession(A, asSessionId("sess_none"))).toEqual([]);
  });

  it("re-recording a decision does not duplicate it in the session", async () => {
    const ledger = memoryDecisionLedger();
    const decision = NoOpDecision.of(facts("dec_1"), "control-arm");
    await ledger.record(decision);
    await ledger.record(decision);
    expect(await ledger.bySession(A, S)).toHaveLength(1);
  });
});
