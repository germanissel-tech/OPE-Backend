// US2 (FR-015, FR-052; ADR-007): batch invariants, in the pure domain.
import { describe, expect, it } from "vitest";
import { checkBatch, TIMESTAMP_TOLERANCE, type Event } from "../../../../src/domain/ingestion/index.js";
import { asEventId, asSessionId, asVisitorId } from "../../../../src/domain/shared-kernel/index.js";

const now = new Date("2026-09-16T12:00:00.000Z");
const at = (offsetMs: number) => new Date(now.getTime() + offsetMs);
const MIN = 60_000;
const HOUR = 60 * MIN;

function event(n: number, over: Partial<Event> = {}): Event {
  return {
    type: "product_viewed",
    eventId: asEventId(`evt_${String(n).padStart(8, "0")}`),
    sessionId: asSessionId("ses_00000001"),
    visitorId: asVisitorId("vis_00000001"),
    occurredAt: now,
    page: { pageType: "product", productId: "SKU-1" },
    device: "mobile",
    ...over,
  } as Event;
}

describe("checkBatch", () => {
  it("a batch of one session, one visitor and instants within tolerance is ok", () => {
    expect(checkBatch({ events: [event(1), event(2), event(3)] }, now)).toEqual({
      ok: true,
      value: undefined,
    });
  });

  it("a batch of a single event is ok", () => {
    expect(checkBatch({ events: [event(1)] }, now)).toEqual({ ok: true, value: undefined });
  });

  it("[invariant:session-visitor-mismatch] two visitors in the same batch → rejected", () => {
    const result = checkBatch(
      { events: [event(1), event(2, { visitorId: asVisitorId("vis_00000002") })] },
      now,
    );
    expect(result).toMatchObject({ ok: false, error: { code: "session-visitor-mismatch" } });
  });

  it("[invariant:session-visitor-mismatch] two sessions in the same batch → rejected", () => {
    const result = checkBatch(
      { events: [event(1), event(2, { sessionId: asSessionId("ses_00000002") })] },
      now,
    );
    expect(result).toMatchObject({ ok: false, error: { code: "session-visitor-mismatch" } });
  });

  it("[invariant:event-timestamp-out-of-range] timestamp out of tolerance → rejected", () => {
    const future = checkBatch({ events: [event(1, { occurredAt: at(6 * MIN) })] }, now);
    expect(future).toMatchObject({ ok: false, error: { code: "event-timestamp-out-of-range" } });
    const past = checkBatch({ events: [event(1, { occurredAt: at(-25 * HOUR) })] }, now);
    expect(past).toMatchObject({ ok: false, error: { code: "event-timestamp-out-of-range" } });
  });

  it("the tolerance edges (+5 min, -24 h) pass", () => {
    expect(TIMESTAMP_TOLERANCE).toEqual({ pastMs: 24 * HOUR, futureMs: 5 * MIN });
    expect(checkBatch({ events: [event(1, { occurredAt: at(5 * MIN) })] }, now)).toEqual({
      ok: true,
      value: undefined,
    });
    expect(checkBatch({ events: [event(1, { occurredAt: at(-24 * HOUR) })] }, now)).toEqual({
      ok: true,
      value: undefined,
    });
  });

  it("the first violated invariant wins: session mix before timestamp", () => {
    const result = checkBatch(
      { events: [event(1), event(2, { sessionId: asSessionId("ses_00000002"), occurredAt: at(HOUR) })] },
      now,
    );
    expect(result).toMatchObject({ ok: false, error: { code: "session-visitor-mismatch" } });
  });
});
