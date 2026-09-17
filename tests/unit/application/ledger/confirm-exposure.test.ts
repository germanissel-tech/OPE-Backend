// US4 (FR-031, FR-052; ADR-007): exposure invariants, with fake ledgers.
import { describe, expect, it } from "vitest";
import {
  makeConfirmExposure,
  type ConfirmExposureInput,
  type DecisionLedger,
  type ExposureLedger,
} from "../../../../src/application/ledger/index.js";
import {
  asDecisionId,
  asMerchantId,
  asSessionId,
  asVisitorId,
} from "../../../../src/domain/shared-kernel/index.js";
import type { Decision } from "../../../../src/domain/ledger/index.js";

const A = asMerchantId("m_a");
const B = asMerchantId("m_b");
const now = new Date("2026-09-16T12:00:00.000Z");

const decision = (over: Partial<Decision> = {}): Decision => ({
  decisionId: asDecisionId("dec_00000001"),
  merchantId: A,
  sessionId: asSessionId("ses_00000001"),
  visitorId: asVisitorId("vis_00000001"),
  decidedAt: now,
  outcome: "INTERVENE",
  reason: "barrier-size",
  intervention: { messageVersionId: "msg-1", anchor: "size_selector" },
  ...over,
});

function fakes(decisions: Decision[]) {
  const store = new Map(decisions.map((d) => [`${d.merchantId}/${d.decisionId}`, d]));
  const recorded: string[] = [];
  const decisionLedger: DecisionLedger = {
    record: () => "accepted",
    find: (m, id) => store.get(`${m}/${id}`),
  };
  const exposureLedger: ExposureLedger = {
    record: (e) => {
      const key = `${e.merchantId}/${e.decisionId}`;
      if (recorded.includes(key)) return "already-recorded";
      recorded.push(key);
      return "recorded";
    },
    find: () => undefined,
  };
  return { decisionLedger, exposureLedger, recorded };
}

const input = (over: Partial<ConfirmExposureInput> = {}): ConfirmExposureInput => ({
  merchantId: A,
  decisionId: asDecisionId("dec_00000001"),
  sessionId: asSessionId("ses_00000001"),
  visitorId: asVisitorId("vis_00000001"),
  exposedAt: now,
  anchor: "size_selector",
  ...over,
});

describe("confirmExposure", () => {
  it("[invariant:exposure-decision-unknown] nonexistent decision or of another merchant → rejected", async () => {
    const f = fakes([decision({ merchantId: B })]);
    const confirm = makeConfirmExposure(f);
    expect(await confirm(input())).toMatchObject({ ok: false, invariant: "exposure-decision-unknown" });
    expect(await confirm(input({ decisionId: asDecisionId("dec_nadie00") }))).toMatchObject({
      ok: false,
      invariant: "exposure-decision-unknown",
    });
    expect(f.recorded).toEqual([]);
  });

  it("[invariant:exposure-decision-unknown] session or visitor different from the decision ones → same response", async () => {
    const confirm = makeConfirmExposure(fakes([decision()]));
    expect(await confirm(input({ sessionId: asSessionId("ses_00000002") }))).toMatchObject({
      ok: false,
      invariant: "exposure-decision-unknown",
    });
    expect(await confirm(input({ visitorId: asVisitorId("vis_00000002") }))).toMatchObject({
      ok: false,
      invariant: "exposure-decision-unknown",
    });
  });

  it("[invariant:exposure-of-no-op] NO_OP decision → rejected", async () => {
    const noOp = decision({ outcome: "NO_OP", reason: "decision-plane-unavailable" });
    delete noOp.intervention;
    const confirm = makeConfirmExposure(fakes([noOp]));
    expect(await confirm(input())).toMatchObject({ ok: false, invariant: "exposure-of-no-op" });
  });

  it("own INTERVENE decision → recorded; repeated → already-recorded without a second record", async () => {
    const f = fakes([decision()]);
    const confirm = makeConfirmExposure(f);
    expect(await confirm(input())).toEqual({ ok: true, status: "recorded" });
    expect(await confirm(input())).toEqual({ ok: true, status: "already-recorded" });
    expect(f.recorded).toEqual(["m_a/dec_00000001"]);
  });

  it("exposure ledger unavailable → not ok, no invariant, nothing recorded (ADR-021)", async () => {
    const f = fakes([decision()]);
    const confirm = makeConfirmExposure({
      decisionLedger: f.decisionLedger,
      exposureLedger: { record: () => "unavailable", find: () => undefined },
    });
    expect(await confirm(input())).toEqual({ ok: false, unavailable: true });
    expect(f.recorded).toEqual([]);
  });
});
