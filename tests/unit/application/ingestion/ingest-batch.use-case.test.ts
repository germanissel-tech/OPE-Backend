// US3 (FR-022, FR-025; ADR-021, ADR-023): the use case returns typed errors and handles the
// ledger degradation itself, with fake ports.
import { describe, expect, it } from "vitest";
import { IngestBatchUseCase, type EventDedup } from "../../../../src/application/ingestion/index.js";
import { SessionVisitorMismatch, type Event, asEventId } from "../../../../src/domain/ingestion/index.js";
import { LedgerUnavailable, type Decision, asDecisionId } from "../../../../src/domain/ledger/index.js";
import {
  asMerchantId,
  asSessionId,
  asVisitorId,
  fail,
  ok,
} from "../../../../src/domain/shared-kernel/index.js";
import { recordingLogger } from "../../../helpers/unavailable-ledgers.js";
import type { AssignmentService } from "../../../../src/application/experiment/index.js";
import type { DecisionLedger } from "../../../../src/application/ledger/index.js";

const NOW = new Date("2026-09-17T12:00:00.000Z");
const A = asMerchantId("m_a");

const event = (n: number, visitor = 1): Event => ({
  type: "product_viewed",
  eventId: asEventId(`evt_0000000${n}`),
  sessionId: asSessionId("ses_00000001"),
  visitorId: asVisitorId(`vis_0000000${visitor}`),
  occurredAt: NOW,
  page: { pageType: "product", productId: "SKU-1" },
  device: "mobile",
});

function subject(over: { decisions?: DecisionLedger; assignment?: AssignmentService } = {}) {
  const recorded: Decision[] = [];
  const decisions: DecisionLedger = over.decisions ?? {
    record: (d) => {
      recorded.push(d);
      return Promise.resolve(ok(undefined));
    },
    find: () => Promise.resolve(undefined),
  };
  const eventDedup: EventDedup = { claim: (_m, ids) => Promise.resolve(new Set(ids)) };
  const assignment: AssignmentService = over.assignment ?? { assign: () => Promise.resolve(ok(undefined)) };
  const { logger, entries } = recordingLogger();
  const useCase = new IngestBatchUseCase({
    clock: { now: () => NOW },
    decisionIds: { next: () => asDecisionId("dec_00000001") },
    logger,
    eventDedup,
    decisions,
    assignment,
  });
  return { useCase, recorded, entries };
}

describe("IngestBatchUseCase", () => {
  it("[invariant:session-visitor-mismatch] two visitors → a typed error of the ingestion module", async () => {
    const { useCase, recorded } = subject();
    const result = await useCase.execute({ merchantId: A, events: [event(1, 1), event(2, 2)] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(SessionVisitorMismatch);
    expect(result.error).toMatchObject({ code: "session-visitor-mismatch", module: "ingestion" });
    expect(recorded).toEqual([]);
  });

  it("without an active experiment the decision is NO_OP no-active-experiment and gets recorded", async () => {
    const { useCase, recorded } = subject();
    const result = await useCase.execute({ merchantId: A, events: [event(1)] });
    expect(result).toMatchObject({ ok: true, value: { accepted: 1, duplicates: 0 } });
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ outcome: "NO_OP", reason: "no-active-experiment" });
  });

  it("decision ledger unavailable → NO_OP ledger-unavailable, handled inside the use case (ADR-021)", async () => {
    const { useCase, entries } = subject({
      decisions: {
        record: () => Promise.resolve(fail(new LedgerUnavailable())),
        find: () => Promise.resolve(undefined),
      },
    });
    const result = await useCase.execute({ merchantId: A, events: [event(1)] });
    expect(result).toMatchObject({
      ok: true,
      value: { decision: { outcome: "NO_OP", reason: "ledger-unavailable" } },
    });
    expect(entries.map((e) => e.message)).toEqual(["decision not recorded: ledger-unavailable"]);
  });

  it("assignment ledger unavailable → NO_OP ledger-unavailable without recording the decision", async () => {
    const { useCase, recorded, entries } = subject({
      assignment: { assign: () => Promise.resolve(fail(new LedgerUnavailable())) },
    });
    const result = await useCase.execute({ merchantId: A, events: [event(1)] });
    expect(result).toMatchObject({
      ok: true,
      value: { decision: { outcome: "NO_OP", reason: "ledger-unavailable" } },
    });
    expect(recorded).toEqual([]);
    expect(entries.map((e) => e.message)).toEqual(["assignment not recorded: ledger-unavailable"]);
  });
});
