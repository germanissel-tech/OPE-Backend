// US2 (FR-015, FR-052; ADR-007): invariantes del lote, en el dominio puro.
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
  it("un lote de una sesión, un visitante y instantes en tolerancia está ok", () => {
    expect(checkBatch({ events: [event(1), event(2), event(3)] }, now)).toEqual({ ok: true });
  });

  it("un lote de un solo evento está ok", () => {
    expect(checkBatch({ events: [event(1)] }, now)).toEqual({ ok: true });
  });

  it("[invariant:session-visitor-mismatch] dos visitantes en el mismo lote → rechazado", () => {
    const result = checkBatch(
      { events: [event(1), event(2, { visitorId: asVisitorId("vis_00000002") })] },
      now,
    );
    expect(result).toMatchObject({ ok: false, invariant: "session-visitor-mismatch" });
  });

  it("[invariant:session-visitor-mismatch] dos sesiones en el mismo lote → rechazado", () => {
    const result = checkBatch(
      { events: [event(1), event(2, { sessionId: asSessionId("ses_00000002") })] },
      now,
    );
    expect(result).toMatchObject({ ok: false, invariant: "session-visitor-mismatch" });
  });

  it("[invariant:event-timestamp-out-of-range] instante fuera de tolerancia → rechazado", () => {
    const future = checkBatch({ events: [event(1, { occurredAt: at(6 * MIN) })] }, now);
    expect(future).toMatchObject({ ok: false, invariant: "event-timestamp-out-of-range" });
    const past = checkBatch({ events: [event(1, { occurredAt: at(-25 * HOUR) })] }, now);
    expect(past).toMatchObject({ ok: false, invariant: "event-timestamp-out-of-range" });
  });

  it("los bordes de la tolerancia (+5 min, -24 h) pasan", () => {
    expect(TIMESTAMP_TOLERANCE).toEqual({ pastMs: 24 * HOUR, futureMs: 5 * MIN });
    expect(checkBatch({ events: [event(1, { occurredAt: at(5 * MIN) })] }, now)).toEqual({ ok: true });
    expect(checkBatch({ events: [event(1, { occurredAt: at(-24 * HOUR) })] }, now)).toEqual({ ok: true });
  });

  it("la primera invariante violada gana: mezcla de sesión antes que instante", () => {
    const result = checkBatch(
      { events: [event(1), event(2, { sessionId: asSessionId("ses_00000002"), occurredAt: at(HOUR) })] },
      now,
    );
    expect(result).toMatchObject({ ok: false, invariant: "session-visitor-mismatch" });
  });
});
