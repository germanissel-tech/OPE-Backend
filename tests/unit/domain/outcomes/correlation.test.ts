// Feature 013 (FR-002, FR-003, FR-041; SC-001): the correlation the session's decisions
// sustain — none without decisions — and the crossing of the incentive declared with the one
// granted, by table.
import { describe, expect, it } from "vitest";
import {
  asDecisionId,
  InterveneDecision,
  NoOpDecision,
  type Decision,
  type DecisionFacts,
} from "../../../../src/domain/ledger/index.js";
import {
  Correlation,
  IncentiveRedemption,
  REDEMPTION_VERDICTS,
} from "../../../../src/domain/outcomes/index.js";
import {
  asExperimentId,
  asMerchantId,
  asSessionId,
  asVisitorId,
  type Incentive,
} from "../../../../src/domain/shared-kernel/index.js";

const S = asSessionId("ses_00000001");
const facts = (id: string, over: Partial<DecisionFacts> = {}): DecisionFacts => ({
  decisionId: asDecisionId(id),
  merchantId: asMerchantId("m_a"),
  sessionId: S,
  visitorId: asVisitorId("vis_00000001"),
  decidedAt: new Date("2026-09-19T12:00:00.000Z"),
  configuration: { platform: "platform-1", defaults: "defaults-1" },
  ...over,
});
const experiment = { experimentId: asExperimentId("exp_1"), arm: "TREATMENT" as const };
const noOp = (id: string, over: Partial<DecisionFacts> = {}): Decision =>
  NoOpDecision.of(facts(id, over), "control-arm");
const intervene = (id: string, incentive?: Incentive, over: Partial<DecisionFacts> = {}): Decision =>
  InterveneDecision.of(facts(id, over), "price", {
    anchor: "price",
    messageVersionId: "mv_price_price_incentive_es_neutral_1",
    text: "If it does not fit, the exchange is free.",
    ...(incentive === undefined ? {} : { incentive }),
  });
const percent = (value: number): Incentive => ({ kind: "percent", value });

describe("Correlation.of", () => {
  it("without decisions the session is unknown: no correlation", () => {
    expect(Correlation.of(S, [])).toBeUndefined();
  });

  it("with decisions: the visitor of the session; no experiment when none had one", () => {
    const correlation = Correlation.of(S, [noOp("d1"), noOp("d2")]);
    expect(correlation).toBeDefined();
    expect(correlation?.sessionId).toBe(S);
    expect(correlation?.visitorId).toBe("vis_00000001");
    expect(correlation?.experiment).toBeUndefined();
  });

  it("the experiment of the last decision that had one", () => {
    const other = { experimentId: asExperimentId("exp_2"), arm: "CONTROL" as const };
    const correlation = Correlation.of(S, [
      noOp("d1", { experiment }),
      noOp("d2", { experiment: other }),
      noOp("d3"),
    ]);
    expect(correlation?.experiment).toEqual(other);
  });

  it("rehydrate keeps what was recorded", () => {
    const record = { sessionId: S, visitorId: asVisitorId("v"), experiment };
    expect(Correlation.rehydrate(record)).toMatchObject(record);
  });
});

describe("IncentiveRedemption.of — the table", () => {
  const granted5 = [noOp("d0"), intervene("d1", percent(5))];

  interface Row {
    declared?: Incentive;
    correlated: boolean;
    decisions: readonly Decision[];
    verdict?: string;
  }
  it.each<[string, Row]>([
    [
      "declared = granted → matched",
      { declared: percent(5), correlated: true, decisions: granted5, verdict: "matched" },
    ],
    [
      "declared ≠ granted → mismatched",
      { declared: percent(10), correlated: true, decisions: granted5, verdict: "mismatched" },
    ],
    [
      "granted, nothing declared → not-applied",
      { correlated: true, decisions: granted5, verdict: "not-applied" },
    ],
    [
      "declared, nothing granted in the session → not-granted",
      { declared: percent(5), correlated: true, decisions: [noOp("d0")], verdict: "not-granted" },
    ],
    [
      "declared, no correlation → unverifiable",
      { declared: percent(5), correlated: false, decisions: [], verdict: "unverifiable" },
    ],
    ["nothing declared, nothing granted → no redemption", { correlated: true, decisions: [noOp("d0")] }],
    ["nothing declared, no correlation → no redemption", { correlated: false, decisions: [] }],
  ])("%s", (_name, row) => {
    const verdict = IncentiveRedemption.of(row.declared, row.correlated, row.decisions)?.verdict;
    expect(verdict).toBe(row.verdict);
    if (verdict !== undefined) expect(REDEMPTION_VERDICTS).toContain(verdict);
  });

  it("keeps what was declared and what was granted, with the decision that granted it", () => {
    const redemption = IncentiveRedemption.of(percent(10), true, granted5);
    expect(redemption?.declared).toEqual(percent(10));
    expect(redemption?.granted).toEqual({ decisionId: "d1", incentive: percent(5) });
    const notGranted = IncentiveRedemption.of(percent(5), true, [noOp("d0")]);
    expect(notGranted?.declared).toEqual(percent(5));
    expect(notGranted?.granted).toBeUndefined();
    const notApplied = IncentiveRedemption.of(undefined, true, granted5);
    expect(notApplied?.declared).toBeUndefined();
    expect(notApplied?.granted?.decisionId).toBe("d1");
  });

  it("the last intervention with an incentive wins; NO_OPs and interventions without one are ignored", () => {
    const decisions = [
      intervene("d1", percent(5)),
      intervene("d2", percent(10)),
      intervene("d3"),
      noOp("d4"),
    ];
    expect(IncentiveRedemption.of(percent(10), true, decisions)?.verdict).toBe("matched");
    expect(IncentiveRedemption.of(percent(5), true, decisions)?.granted?.decisionId).toBe("d2");
  });

  it("granted is looked up even without a correlation, but the verdict is unverifiable when declared", () => {
    expect(IncentiveRedemption.of(percent(5), false, granted5)?.verdict).toBe("unverifiable");
  });

  it("rehydrate keeps what was recorded", () => {
    const record = {
      verdict: "matched" as const,
      declared: percent(5),
      granted: { decisionId: asDecisionId("d1"), incentive: percent(5) },
    };
    expect(IncentiveRedemption.rehydrate(record)).toMatchObject(record);
  });
});
