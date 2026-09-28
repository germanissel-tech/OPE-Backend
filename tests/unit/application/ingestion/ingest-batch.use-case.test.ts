// Feature 008, US3 (FR-022, FR-025; ADR-023, ADR-026): the use case returns typed errors, deduplicates and
// hands the valid batch to the decision plane, with fake ports.
import { describe, expect, it } from "vitest";
import {
  IngestBatchUseCase,
  type DecisionPlane,
  type EventDedup,
  type DecisionRequest,
} from "../../../../src/application/ingestion/index.js";
import {
  SessionVisitorMismatch,
  asBatchId,
  asEventId,
  type Event,
  type EventId,
} from "../../../../src/domain/ingestion/index.js";
import { NoOpDecision, asDecisionId } from "../../../../src/domain/ledger/index.js";
import { asMerchantId, asSessionId, asVisitorId } from "../../../../src/domain/shared-kernel/index.js";
import { memoryEventLog } from "../../../../src/interface-adapters/ingestion/index.js";
import { TEST_TOLERANCE, TEST_VERSIONS } from "../../../helpers/platform.js";

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

function subject(seen: readonly EventId[] = []) {
  const requests: DecisionRequest[] = [];
  const decisionPlane: DecisionPlane = {
    decide: (request) => {
      requests.push(request);
      const { merchantId, batch, now } = request;
      return Promise.resolve(
        NoOpDecision.of(
          {
            decisionId: asDecisionId("dec_00000001"),
            configuration: TEST_VERSIONS,
            merchantId,
            sessionId: batch.sessionId,
            visitorId: batch.visitorId,
            decidedAt: now,
          },
          "barrier-unclear",
        ),
      );
    },
  };
  const eventDedup: EventDedup = {
    claim: (_m, ids) => Promise.resolve(new Set(ids.filter((id) => !seen.includes(id)))),
  };
  // The register of feature 031: the real in-memory one, so what the use case hands it is judged by
  // the same reads a suite would use rather than by a spy agreeing with whatever was passed.
  const eventLog = memoryEventLog();
  const useCase = new IngestBatchUseCase({
    clock: { now: () => NOW },
    tolerance: TEST_TOLERANCE,
    eventDedup,
    decisionPlane,
    eventLog,
    batchIds: { next: () => asBatchId("bat_test") },
  });
  return { useCase, requests, eventLog };
}

describe("IngestBatchUseCase", () => {
  it("[invariant:session-visitor-mismatch] two visitors → a typed error of the ingestion module, nothing decided", async () => {
    const { useCase, requests } = subject();
    const result = await useCase.execute({ merchantId: A, events: [event(1, 1), event(2, 2)] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBeInstanceOf(SessionVisitorMismatch);
    expect(result.error).toMatchObject({ code: "session-visitor-mismatch", module: "ingestion" });
    expect(requests).toEqual([]);
  });

  it("a valid batch is deduplicated and handed to the decision plane with the merchant, the batch and the instant", async () => {
    const { useCase, requests } = subject([asEventId("evt_00000002")]);
    const result = await useCase.execute({ merchantId: A, events: [event(1), event(2), event(3), event(3)] });
    expect(result).toMatchObject({
      ok: true,
      value: {
        accepted: 2,
        duplicates: 2,
        results: [
          { eventId: "evt_00000001", status: "accepted" },
          { eventId: "evt_00000002", status: "duplicate" },
          { eventId: "evt_00000003", status: "accepted" },
          { eventId: "evt_00000003", status: "duplicate" },
        ],
        decision: { outcome: "NO_OP", reason: "barrier-unclear", decisionId: "dec_00000001" },
      },
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]?.merchantId).toBe(A);
    expect(requests[0]?.now).toBe(NOW);
    expect(requests[0]?.batch.events).toHaveLength(4);
  });

  it("the decision the plane answers is returned as is (the plane already degraded it if the ledger was down)", async () => {
    const { useCase } = subject();
    const result = await useCase.execute({ merchantId: A, events: [event(1)] });
    expect(result.ok && result.value.decision).toBeInstanceOf(NoOpDecision);
  });

  describe("what it hands the register (feature 031)", () => {
    it("records every event of the batch with the decision it produced", async () => {
      const { useCase, eventLog } = subject();
      await useCase.execute({ merchantId: A, events: [event(1), event(2)] });

      const recorded = await eventLog.byDecision(A, asDecisionId("dec_00000001"));
      expect(recorded).toHaveLength(2);
      // Positions are the batch's own order, which is what makes `(batch, position)` an identity.
      expect(recorded.map((row) => row.position)).toEqual([0, 1]);
      expect(recorded.map((row) => row.event.eventId)).toEqual([
        asEventId("evt_00000001"),
        asEventId("evt_00000002"),
      ]);
      // Received when OPE received it, not when the client says the event happened.
      expect(recorded[0]?.receivedAt).toBe(NOW);
    });

    it("records a repeated event as a repetition, not as a second first arrival", async () => {
      // The duplicate still reaches the plane — it is given the whole batch — so it names the decision
      // it took part in. What it does not claim is to have entered for the first time (FR-005).
      const { useCase, eventLog } = subject();
      await useCase.execute({ merchantId: A, events: [event(1), event(1)] });

      const recorded = await eventLog.byEvent(A, asEventId("evt_00000001"));
      expect(recorded.map((row) => row.disposition)).toEqual(["accepted", "duplicate"]);
    });

    it("records no arm when the merchant has no active experiment, and never invents CONTROL", async () => {
      // The fake plane answers a decision without an experiment, which is what a merchant without one
      // produces. Writing CONTROL here would put traffic that was never in an experiment into the
      // control group of the pilot's own figures.
      const { useCase, eventLog } = subject();
      await useCase.execute({ merchantId: A, events: [event(1)] });

      const [recorded] = await eventLog.byDecision(A, asDecisionId("dec_00000001"));
      expect(recorded?.disposition).not.toBe("rejected");
      if (recorded === undefined || recorded.disposition === "rejected") return;
      expect(recorded.arm).toBeUndefined();
    });

    it("records a batch an invariant refused, with the invariant and no decision", async () => {
      // The traffic that is most invisible today: OPE answers `422` and nothing is left behind, so an
      // operator sees silence and cannot tell it from a merchant that sent nothing (FR-006).
      const { useCase, eventLog } = subject();
      const result = await useCase.execute({ merchantId: A, events: [event(1, 1), event(2, 2)] });
      expect(result.ok).toBe(false);

      const rows = await eventLog.byEvent(A, asEventId("evt_00000001"));
      expect(rows).toHaveLength(1);
      const [row] = rows;
      expect(row?.disposition).toBe("rejected");
      if (row?.disposition !== "rejected") return;
      expect(row.rejectedBy).toBe("session-visitor-mismatch");
    });

    it("records every event of a refused batch, showing the mismatch that refused it", async () => {
      // **Showing the mismatch is the point.** The invariant fired *because* the batch mixed visitors,
      // so there is no single visitor of the batch to name — each row carries its own, and that is
      // exactly what an operator needs to fix the integration (research R-07).
      const { useCase, eventLog } = subject();
      await useCase.execute({ merchantId: A, events: [event(1, 1), event(2, 2)] });

      const rows = await eventLog.bySession(A, asSessionId("ses_00000001"));
      expect(rows).toHaveLength(2);
      expect(rows.map((row) => row.position)).toEqual([0, 1]);
      expect(rows.map((row) => row.event.visitorId)).toEqual([
        asVisitorId("vis_00000001"),
        asVisitorId("vis_00000002"),
      ]);
    });

    it("leaves a refused batch unreachable from any decision, because it produced none", async () => {
      const { useCase, eventLog } = subject();
      await useCase.execute({ merchantId: A, events: [event(1, 1), event(2, 2)] });

      expect(await eventLog.byDecision(A, asDecisionId("dec_00000001"))).toEqual([]);
    });
  });
});
