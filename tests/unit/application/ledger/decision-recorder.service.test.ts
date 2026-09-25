// Feature 011 (R-06): the ledger mints the id and records what the plane decided; a ledger
// that cannot accept the record degrades the decision to NO_OP ledger-unavailable (ADR-021).
import { describe, expect, it } from "vitest";
import {
  DefaultDecisionRecorder,
  type DecisionFactsInput,
} from "../../../../src/application/ledger/index.js";
import { asDecisionId, InterveneDecision, NoOpDecision } from "../../../../src/domain/ledger/index.js";
import { asMerchantId, asSessionId, asVisitorId } from "../../../../src/domain/shared-kernel/index.js";
import { memoryDecisionLedger } from "../../../../src/interface-adapters/ledger/gateways/memory-decision-ledger.js";
import { TEST_VERSIONS } from "../../../helpers/platform.js";
import { recordingLogger, unavailableDecisionLedger } from "../../../helpers/unavailable-ledgers.js";

const facts: DecisionFactsInput = {
  configuration: TEST_VERSIONS,
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
const intervention = {
  text: "If it does not fit, the exchange is free.",
  messageVersionId: "msg_fit_size_selector_v0",
  anchor: "size_selector" as const,
};

function ids(): { next: () => ReturnType<typeof asDecisionId>; minted: number } {
  const state = { minted: 0, next: () => asDecisionId(`dec_${String(++state.minted).padStart(8, "0")}`) };
  return state;
}

describe("DefaultDecisionRecorder", () => {
  it("mints one id per decision and records a NO_OP with its inference", async () => {
    const decisions = memoryDecisionLedger();
    const decisionIds = ids();
    const recorder = new DefaultDecisionRecorder({
      decisions,
      decisionIds,
      logger: recordingLogger().logger,
    });
    const recorded = await recorder.record(facts, { kind: "no-op", reason: "barrier-unclear" });
    expect(recorded).toBeInstanceOf(NoOpDecision);
    expect(recorded.decisionId).toBe("dec_00000001");
    expect(recorded.reason).toBe("barrier-unclear");
    expect(recorded.inference).toEqual(facts.inference);
    expect(await decisions.find(facts.merchantId, recorded.decisionId)).toBe(recorded);
    expect(decisionIds.minted).toBe(1);
  });

  it("records an INTERVENE with its intervention and the barrier as reason", async () => {
    const recorder = new DefaultDecisionRecorder({
      decisions: memoryDecisionLedger(),
      decisionIds: ids(),
      logger: recordingLogger().logger,
    });
    const recorded = await recorder.record(facts, { kind: "intervene", reason: "fit", intervention });
    expect(recorded).toBeInstanceOf(InterveneDecision);
    expect(recorded.isIntervention() && recorded.intervention).toEqual(intervention);
    expect(recorded.reason).toBe("fit");
  });

  it("a ledger that cannot accept the record → NO_OP ledger-unavailable with the minted id, logged without the visitor", async () => {
    const { logger, entries } = recordingLogger();
    const recorder = new DefaultDecisionRecorder({
      decisions: unavailableDecisionLedger(),
      decisionIds: ids(),
      logger,
    });
    const degraded = await recorder.record(facts, { kind: "intervene", reason: "fit", intervention });
    expect(degraded).toBeInstanceOf(NoOpDecision);
    expect(degraded.reason).toBe("ledger-unavailable");
    expect(degraded.decisionId).toBe("dec_00000001");
    expect(degraded.inference).toEqual(facts.inference);
    expect(entries).toEqual([
      {
        level: "error",
        fields: { merchantId: "m_a", decisionId: "dec_00000001" },
        message: "decision not recorded: ledger-unavailable",
      },
    ]);
  });

  it("unrecorded: a decision the ledger never saw, with an id and the reason why", () => {
    const { logger, entries } = recordingLogger();
    const recorder = new DefaultDecisionRecorder({
      decisions: memoryDecisionLedger(),
      decisionIds: ids(),
      logger,
    });
    const degraded = recorder.unrecorded(facts, "assignment not recorded");
    expect(degraded.reason).toBe("ledger-unavailable");
    expect(degraded.decisionId).toBe("dec_00000001");
    expect(entries[0]?.message).toBe("assignment not recorded: ledger-unavailable");
  });
});
