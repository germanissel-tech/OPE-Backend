// US4 (FR-031, FR-052; ADR-007): exposure invariants, with fake ledgers.
import { describe, expect, it } from "vitest";
import {
  ConfirmExposureUseCase,
  type ConfirmExposureRequest,
  type DecisionLedger,
  type ExposureLedger,
} from "../../../../src/application/ledger/index.js";
import { LedgerUnavailable, type Decision } from "../../../../src/domain/ledger/index.js";
import {
  asDecisionId,
  asMerchantId,
  asSessionId,
  asVisitorId,
  fail,
  ok,
} from "../../../../src/domain/shared-kernel/index.js";

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
    record: () => Promise.resolve(ok(undefined)),
    find: (m, id) => Promise.resolve(store.get(`${m}/${id}`)),
  };
  const exposureLedger: ExposureLedger = {
    record: (e) => {
      const key = `${e.merchantId}/${e.decisionId}`;
      if (recorded.includes(key)) return Promise.resolve(ok("already-recorded"));
      recorded.push(key);
      return Promise.resolve(ok("recorded"));
    },
    find: () => Promise.resolve(undefined),
  };
  return { decisions: decisionLedger, exposures: exposureLedger, recorded };
}

const input = (over: Partial<ConfirmExposureRequest> = {}): ConfirmExposureRequest => ({
  merchantId: A,
  decisionId: asDecisionId("dec_00000001"),
  sessionId: asSessionId("ses_00000001"),
  visitorId: asVisitorId("vis_00000001"),
  exposedAt: now,
  anchor: "size_selector",
  ...over,
});

const subject = (deps: { decisions: DecisionLedger; exposures: ExposureLedger }) => {
  const useCase = new ConfirmExposureUseCase(deps);
  return (request: ConfirmExposureRequest) => useCase.execute(request);
};

describe("ConfirmExposureUseCase", () => {
  it("[invariant:exposure-decision-unknown] nonexistent decision or of another merchant → rejected", async () => {
    const f = fakes([decision({ merchantId: B })]);
    const confirm = subject(f);
    expect(await confirm(input())).toMatchObject({ ok: false, error: { code: "exposure-decision-unknown" } });
    expect(await confirm(input({ decisionId: asDecisionId("dec_nadie00") }))).toMatchObject({
      ok: false,
      error: { code: "exposure-decision-unknown" },
    });
    expect(f.recorded).toEqual([]);
  });

  it("[invariant:exposure-decision-unknown] session or visitor different from the decision ones → same response", async () => {
    const confirm = subject(fakes([decision()]));
    expect(await confirm(input({ sessionId: asSessionId("ses_00000002") }))).toMatchObject({
      ok: false,
      error: { code: "exposure-decision-unknown" },
    });
    expect(await confirm(input({ visitorId: asVisitorId("vis_00000002") }))).toMatchObject({
      ok: false,
      error: { code: "exposure-decision-unknown" },
    });
  });

  it("[invariant:exposure-of-no-op] NO_OP decision → rejected", async () => {
    const noOp = decision({ outcome: "NO_OP", reason: "decision-plane-unavailable" });
    delete noOp.intervention;
    const confirm = subject(fakes([noOp]));
    expect(await confirm(input())).toMatchObject({ ok: false, error: { code: "exposure-of-no-op" } });
  });

  it("own INTERVENE decision → recorded; repeated → already-recorded without a second record", async () => {
    const f = fakes([decision()]);
    const confirm = subject(f);
    expect(await confirm(input())).toEqual({ ok: true, value: "recorded" });
    expect(await confirm(input())).toEqual({ ok: true, value: "already-recorded" });
    expect(f.recorded).toEqual(["m_a/dec_00000001"]);
  });

  it("exposure ledger unavailable → not ok with error ledger-unavailable, nothing recorded (ADR-021)", async () => {
    const f = fakes([decision()]);
    const confirm = subject({
      decisions: f.decisions,
      exposures: {
        record: () => Promise.resolve(fail(new LedgerUnavailable())),
        find: () => Promise.resolve(undefined),
      },
    });
    expect(await confirm(input())).toMatchObject({ ok: false, error: { code: "ledger-unavailable" } });
    expect(f.recorded).toEqual([]);
  });
});
