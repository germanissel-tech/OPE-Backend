// US3 (FR-020, FR-021) and ADR-024: a decision is NO_OP with a reason of the catalogue or
// INTERVENE with its intervention; nothing in between exists, and a recorded one comes back as
// what it was.
import { describe, expect, it } from "vitest";
import {
  DecisionBase,
  InterveneDecision,
  NoOpDecision,
  type DecisionFacts,
  type DecisionRecord,
  asDecisionId,
} from "../../../../src/domain/ledger/index.js";
import { asMerchantId, asSessionId, asVisitorId } from "../../../../src/domain/shared-kernel/index.js";

const now = new Date("2026-09-16T12:00:00.000Z");
const facts: DecisionFacts = {
  decisionId: asDecisionId("dec_00000001"),
  merchantId: asMerchantId("m_a"),
  sessionId: asSessionId("ses_00000001"),
  visitorId: asVisitorId("vis_00000001"),
  decidedAt: now,
};
const intervention = { messageVersionId: "msg-1", anchor: "size_selector" as const };

describe("NoOpDecision.of", () => {
  it("produces a NO_OP decision without intervention, with everything the ledger records", () => {
    const decision = NoOpDecision.of(facts, "decision-plane-unavailable");
    expect(decision).toEqual({ ...facts, outcome: "NO_OP", reason: "decision-plane-unavailable" });
    expect(decision.isIntervention()).toBe(false);
    expect(JSON.parse(JSON.stringify(decision))).not.toHaveProperty("intervention");
  });

  it("keeps the experiment and arm when the visitor was assigned", () => {
    const experiment = { experimentId: "exp_00000001" as never, arm: "CONTROL" as const };
    expect(NoOpDecision.of({ ...facts, experiment }, "control-arm").experiment).toEqual(experiment);
  });
});

describe("InterveneDecision.of", () => {
  it("produces an INTERVENE decision that carries its intervention", () => {
    const decision = InterveneDecision.of(facts, "barrier-size", intervention);
    expect(decision).toEqual({ ...facts, outcome: "INTERVENE", reason: "barrier-size", intervention });
    expect(decision.isIntervention()).toBe(true);
  });
});

describe("belongsTo", () => {
  it("is true only for the same session and visitor", () => {
    const decision = NoOpDecision.of(facts, "control-arm");
    expect(decision.belongsTo(facts.sessionId, facts.visitorId)).toBe(true);
    expect(decision.belongsTo(asSessionId("ses_00000002"), facts.visitorId)).toBe(false);
    expect(decision.belongsTo(facts.sessionId, asVisitorId("vis_00000002"))).toBe(false);
  });
});

describe("DecisionBase.rehydrate", () => {
  it("a NO_OP record comes back as a NoOpDecision; an INTERVENE record as an InterveneDecision", () => {
    const noOp = DecisionBase.rehydrate({ ...facts, outcome: "NO_OP", reason: "control-arm" });
    expect(noOp).toBeInstanceOf(NoOpDecision);
    expect(noOp).toEqual({ ...facts, outcome: "NO_OP", reason: "control-arm" });
    const intervene = DecisionBase.rehydrate({
      ...facts,
      outcome: "INTERVENE",
      reason: "barrier-size",
      intervention,
    });
    expect(intervene).toBeInstanceOf(InterveneDecision);
    expect(intervene.isIntervention() && intervene.intervention).toEqual(intervention);
  });

  it("keeps the inference of the plane as it was recorded (constitution IX)", () => {
    const inference = {
      policyVersion: "default-1",
      confidences: { fit: 0.4, price: 0.2, returns: 0 },
      matched: ["fit.size-guide-read"],
      barrier: "fit" as const,
      trigger: "rules" as const,
      evidence: { truth: "absent" as const },
    };
    const noOp = DecisionBase.rehydrate({
      ...facts,
      inference,
      outcome: "NO_OP",
      reason: "control-arm",
    });
    expect(noOp.inference).toEqual(inference);
    expect(JSON.parse(JSON.stringify(NoOpDecision.of(facts, "control-arm")))).not.toHaveProperty("inference");
  });

  it("a corrupt record is a programming error: INTERVENE without intervention, NO_OP with an unknown reason", () => {
    const broken: DecisionRecord = { ...facts, outcome: "INTERVENE", reason: "barrier-size" };
    expect(() => DecisionBase.rehydrate(broken)).toThrow("without an intervention");
    expect(() => DecisionBase.rehydrate({ ...facts, outcome: "NO_OP", reason: "made-up" })).toThrow(
      "unknown reason",
    );
  });
});
