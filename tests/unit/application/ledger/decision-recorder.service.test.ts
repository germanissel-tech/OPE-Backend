// Feature 011 (R-06): the ledger mints the id and records what the plane decided; a ledger
// that cannot accept the record answers LedgerUnavailable (ADR-021).
import { describe, expect, it } from "vitest";
import {
  DefaultDecisionRecorder,
  type DecisionFactsInput,
} from "../../../../src/application/ledger/index.js";
import {
  asDecisionId,
  LedgerUnavailable,
  NoOpDecision,
  InterveneDecision,
} from "../../../../src/domain/ledger/index.js";
import { asMerchantId, asSessionId, asVisitorId } from "../../../../src/domain/shared-kernel/index.js";
import { memoryDecisionLedger } from "../../../../src/interface-adapters/gateways/ledger/memory-decision-ledger.js";
import { unavailableDecisionLedger } from "../../../helpers/unavailable-ledgers.js";

const facts: DecisionFactsInput = {
  merchantId: asMerchantId("m_a"),
  sessionId: asSessionId("ses_00000001"),
  visitorId: asVisitorId("vis_00000001"),
  decidedAt: new Date("2026-09-16T12:00:00.000Z"),
  inference: {
    policyVersion: "default-1",
    confidences: { fit: 0.6, price: 0, returns: 0.2 },
    matched: ["fit.size-guide-read", "fit.photo-zoomed"],
    barrier: "fit",
    trigger: "rules",
    evidence: { truth: "known", stockAndPrice: "fresh", available: true },
  },
};
const intervention = { messageVersionId: "msg_fit_size_selector_v0", anchor: "size_selector" as const };

function ids(): { next: () => ReturnType<typeof asDecisionId>; minted: number } {
  const state = { minted: 0, next: () => asDecisionId(`dec_${String(++state.minted).padStart(8, "0")}`) };
  return state;
}

describe("DefaultDecisionRecorder", () => {
  it("mints one id per decision and records a NO_OP with its inference", async () => {
    const decisions = memoryDecisionLedger();
    const decisionIds = ids();
    const recorder = new DefaultDecisionRecorder({ decisions, decisionIds });
    const recorded = await recorder.record(facts, { kind: "no-op", reason: "page-context-incomplete" });
    expect(recorded.ok && recorded.value).toBeInstanceOf(NoOpDecision);
    if (!recorded.ok) throw new Error("unexpected");
    expect(recorded.value.decisionId).toBe("dec_00000001");
    expect(recorded.value.inference).toEqual(facts.inference);
    expect(await decisions.find(facts.merchantId, recorded.value.decisionId)).toBe(recorded.value);
    expect(decisionIds.minted).toBe(1);
  });

  it("records an INTERVENE with its intervention and the barrier as reason", async () => {
    const recorder = new DefaultDecisionRecorder({ decisions: memoryDecisionLedger(), decisionIds: ids() });
    const recorded = await recorder.record(facts, { kind: "intervene", reason: "fit", intervention });
    if (!recorded.ok) throw new Error("unexpected");
    expect(recorded.value).toBeInstanceOf(InterveneDecision);
    expect(recorded.value.isIntervention() && recorded.value.intervention).toEqual(intervention);
    expect(recorded.value.reason).toBe("fit");
  });

  it("a ledger that cannot accept the record → LedgerUnavailable, nothing else", async () => {
    const recorder = new DefaultDecisionRecorder({
      decisions: unavailableDecisionLedger(),
      decisionIds: ids(),
    });
    const recorded = await recorder.record(facts, { kind: "no-op", reason: "control-arm" });
    expect(!recorded.ok && recorded.error).toBeInstanceOf(LedgerUnavailable);
  });
});
