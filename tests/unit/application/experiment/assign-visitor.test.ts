// US2 (FR-010..FR-013; ADR-022): the assignment is resolved once per visitor and experiment,
// recorded when it happens, stable afterwards, and fails closed when the ledger is unavailable.
import { describe, expect, it } from "vitest";
import { makeAssignVisitor, type AssignmentLedger } from "../../../../src/application/experiment/index.js";
import { assignArm, type Assignment, type Experiment } from "../../../../src/domain/experiment/index.js";
import { asExperimentId, asMerchantId, asVisitorId } from "../../../../src/domain/shared-kernel/index.js";
import { recordingLogger } from "../../../helpers/unavailable-ledgers.js";

const NOW = new Date("2026-09-17T12:00:00.000Z");
const A = asMerchantId("m_a");
const visitor = asVisitorId("vis_00000001");
const experiment: Experiment = {
  experimentId: asExperimentId("exp_00000001"),
  merchantId: A,
  treatmentPercent: 50,
  seed: "seed-alpha",
  status: "active",
  startedAt: NOW,
};

function fakeLedger(initial: Assignment[] = [], unavailable = false) {
  const store = new Map(initial.map((a) => [`${a.merchantId}/${a.experimentId}/${a.visitorId}`, a]));
  const recorded: Assignment[] = [];
  const ledger: AssignmentLedger = {
    record: (a) => {
      if (unavailable) return "unavailable";
      recorded.push(a);
      store.set(`${a.merchantId}/${a.experimentId}/${a.visitorId}`, a);
      return "accepted";
    },
    find: (m, e, v) => store.get(`${m}/${e}/${v}`),
  };
  return { ledger, recorded };
}

const deps = (ledger: AssignmentLedger, active: Experiment | null = experiment) => {
  const { logger, entries } = recordingLogger();
  return {
    assign: makeAssignVisitor({
      experiments: { activeFor: () => active ?? undefined },
      assignments: ledger,
      clock: { now: () => NOW },
      logger,
    }),
    entries,
  };
};

describe("assignVisitor", () => {
  it("without an active experiment nothing is assigned nor recorded", async () => {
    const { ledger, recorded } = fakeLedger();
    const { assign } = deps(ledger, null);
    expect(await assign({ merchantId: A, visitorId: visitor })).toEqual({ ok: true, assignment: undefined });
    expect(recorded).toEqual([]);
  });

  it("the first time it records the computed arm with the clock's instant", async () => {
    const { ledger, recorded } = fakeLedger();
    const { assign } = deps(ledger);
    const result = await assign({ merchantId: A, visitorId: visitor });
    expect(result).toEqual({
      ok: true,
      assignment: {
        merchantId: A,
        experimentId: experiment.experimentId,
        visitorId: visitor,
        arm: assignArm(experiment, visitor),
        assignedAt: NOW,
      },
    });
    expect(recorded).toHaveLength(1);
  });

  it("idempotency: the second time it returns the recorded assignment without recording again", async () => {
    const { ledger, recorded } = fakeLedger();
    const { assign, entries } = deps(ledger);
    const first = await assign({ merchantId: A, visitorId: visitor });
    const second = await assign({ merchantId: A, visitorId: visitor });
    expect(second).toEqual(first);
    expect(recorded).toHaveLength(1);
    expect(entries.filter((e) => e.message.startsWith("assignment-drift"))).toEqual([]);
  });

  it("ledger unavailable → not ok with reason ledger-unavailable", async () => {
    const { ledger, recorded } = fakeLedger([], true);
    const { assign } = deps(ledger);
    expect(await assign({ merchantId: A, visitorId: visitor })).toEqual({
      ok: false,
      reason: "ledger-unavailable",
    });
    expect(recorded).toEqual([]);
  });

  it("stability: a recorded arm wins over the computed one and the drift is logged without the visitor", async () => {
    const computed = assignArm(experiment, visitor);
    const other = computed === "CONTROL" ? "TREATMENT" : "CONTROL";
    const stale: Assignment = {
      merchantId: A,
      experimentId: experiment.experimentId,
      visitorId: visitor,
      arm: other,
      assignedAt: NOW,
    };
    const { ledger } = fakeLedger([stale]);
    const { assign, entries } = deps(ledger);
    const result = await assign({ merchantId: A, visitorId: visitor });
    expect(result).toEqual({ ok: true, assignment: stale });
    const drift = entries.find((e) => e.message.startsWith("assignment-drift"));
    expect(drift?.level).toBe("error");
    expect(drift?.fields).toMatchObject({
      merchantId: A,
      experimentId: experiment.experimentId,
      recorded: other,
      computed,
    });
    expect(JSON.stringify(drift)).not.toContain("vis_00000001");
  });
});
