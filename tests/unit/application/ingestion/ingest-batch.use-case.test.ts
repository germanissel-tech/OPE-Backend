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
  type Event,
  type EventId,
  asEventId,
} from "../../../../src/domain/ingestion/index.js";
import { NoOpDecision, asDecisionId } from "../../../../src/domain/ledger/index.js";
import { asMerchantId, asSessionId, asVisitorId } from "../../../../src/domain/shared-kernel/index.js";

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
  const useCase = new IngestBatchUseCase({ clock: { now: () => NOW }, eventDedup, decisionPlane });
  return { useCase, requests };
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
});
